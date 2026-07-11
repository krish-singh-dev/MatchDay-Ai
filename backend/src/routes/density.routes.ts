import { Router, Request, Response } from 'express';
import { prisma } from '../config/db.client';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { emitDensityUpdate, emitNewAlert } from '../socket/events';
import { Decimal } from '@prisma/client/runtime/library';
import { rateLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// POST /api/v1/density/ingest - Ingest a new density reading
// Requires auth and staff/admin role
router.post('/ingest', requireAuth, requireRole(['staff', 'admin']), rateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { zoneId, estimatedCount } = req.body;

    if (zoneId === undefined || estimatedCount === undefined || estimatedCount === null) {
      res.status(400).json({ error: 'Missing zoneId or estimatedCount parameters' });
      return;
    }

    // Strict boundary and type checks
    if (typeof estimatedCount !== 'number' || !Number.isInteger(estimatedCount) || estimatedCount < 0) {
      res.status(400).json({ error: 'estimatedCount must be a non-negative integer' });
      return;
    }

    if (typeof zoneId !== 'string' || !/^[a-zA-Z0-9_\-]+$/.test(zoneId)) {
      res.status(400).json({ error: 'zoneId must be a valid alphanumeric string' });
      return;
    }

    // 1. Fetch zone to check max capacity
    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }

    // 2. Calculate density percentage
    const densityPctValue = parseFloat((estimatedCount / zone.maxCapacity).toFixed(4));
    
    // 3. Save the density reading
    const reading = await prisma.densityReading.create({
      data: {
        zoneId,
        estimatedCount,
        densityPct: new Decimal(densityPctValue),
      },
    });

    // Cast Decimal to number for standard JSON output and socket updates
    const readingData = {
      ...reading,
      densityPct: densityPctValue,
    };

    // Emit live density update event via Socket.IO
    emitDensityUpdate(readingData as any);

    // 4. Threshold trigger checks
    let severity: 'critical' | 'warning' | null = null;
    if (densityPctValue >= 0.90) {
      severity = 'critical';
    } else if (densityPctValue >= 0.70) {
      severity = 'warning';
    }

    if (severity) {
      // Check if there is already an active (unresolved) alert of the same severity for this zone
      const existingAlert = await prisma.alert.findFirst({
        where: {
          zoneId,
          resolvedAt: null,
        },
      });

      if (!existingAlert) {
        // Create new Alert
        const alert = await prisma.alert.create({
          data: {
            zoneId,
            severity,
            aiRecommendation: 'Mitigation recommendation analysis pending. Request via operations console.',
          },
          include: {
            zone: true,
          },
        });

        // Emit live alert event via Socket.IO
        emitNewAlert(alert as any);
      } else if (existingAlert.severity !== severity) {
        // Update existing alert severity
        const updatedAlert = await prisma.alert.update({
          where: { id: existingAlert.id },
          data: { severity },
          include: { zone: true },
        });

        emitNewAlert(updatedAlert as any);
      }
    }

    res.status(201).json(readingData);
  } catch (error) {
    console.error('Error ingesting density reading:', error);
    res.status(500).json({ error: 'Failed to ingest density reading' });
  }
});

export default router;
