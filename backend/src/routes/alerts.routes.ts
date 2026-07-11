import { Router, Response } from 'express';
import { prisma } from '../config/db.client';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.middleware';
import { askGemini } from '../ai/geminiClient';
import { emitAlertResolved } from '../socket/events';

const router = Router();

/**
 * Builds a formatted text block listing adjacent zones and their current density stats.
 * Used as context in the AI rerouting prompt.
 */
function buildAdjacentZoneStatsText(
  otherZones: Array<{
    name: string;
    zoneType: string;
    maxCapacity: number;
    densityReadings: Array<{ estimatedCount: number; densityPct: any }>;
  }>
): string {
  let statsText = '';
  otherZones.forEach((z) => {
    const reading = z.densityReadings[0];
    const pct = reading ? Math.round(parseFloat(reading.densityPct.toString()) * 100) : 0;
    statsText += `- "${z.name}" (${z.zoneType}): currently at ${pct}% capacity (${reading?.estimatedCount || 0}/${z.maxCapacity} fans)\n`;
  });
  return statsText;
}

/**
 * Builds the Gemini prompt for a crowd-rerouting mitigation recommendation.
 * @param alertZone - The zone experiencing the density spike.
 * @param severity - Alert severity level.
 * @param targetPct - Current occupancy percentage of the alert zone (0–100).
 * @param targetCount - Current estimated fan count in the alert zone.
 * @param adjacentStatsText - Pre-formatted stats string for alternative zones.
 */
function buildReroutingPrompt(
  alertZone: { name: string; zoneType: string; maxCapacity: number },
  severity: string,
  targetPct: number,
  targetCount: number,
  adjacentStatsText: string
): string {
  return `
Generate a concise, actionable crowd capacity mitigation plan.
The target zone "${alertZone.name}" (${alertZone.zoneType}) is experiencing a ${severity} density spike, currently at ${targetPct}% capacity (${targetCount}/${alertZone.maxCapacity} fans).

Alternative available stadium zones:
${adjacentStatsText}
Provide:
1. Short justification of the situation.
2. Clear, numbered rerouting instructions for venue staff and volunteers to redirect traffic away from "${alertZone.name}" to the lowest density alternative zones.
Keep it under 150 words.
`;
}

// Apply auth and staff/admin role gate to all alert endpoints
router.use(requireAuth, requireRole(['staff', 'admin']));

// GET /api/v1/alerts/active/:venueId - Fetch active (unresolved) alerts for a venue
router.get('/active/:venueId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { venueId } = req.params;
    
    const activeAlerts = await prisma.alert.findMany({
      where: {
        resolvedAt: null,
        zone: {
          venueId,
        },
      },
      include: {
        zone: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(activeAlerts);
  } catch (error) {
    console.error('Error fetching active alerts:', error);
    res.status(500).json({ error: 'Failed to fetch active alerts' });
  }
});

// POST /api/v1/alerts/:alertId/acknowledge - Acknowledge alert
router.post('/:alertId/acknowledge', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User context not found' });
      return;
    }

    const updatedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        acknowledgedBy: userId,
      },
      include: {
        zone: true,
      },
    });

    res.status(200).json(updatedAlert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// POST /api/v1/alerts/:alertId/resolve - Resolve alert
router.post('/:alertId/resolve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;

    const resolvedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
      },
      include: {
        zone: true,
      },
    });

    // Emit live alert:resolved event via Socket.IO
    emitAlertResolved(resolvedAlert as any);

    res.status(200).json(resolvedAlert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

// GET /api/v1/alerts/:alertId/recommendation - Fetch AI-generated crowd rerouting mitigation recommendation
router.get('/:alertId/recommendation', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;

    // 1. Fetch the alert and its associated zone
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        zone: true,
      },
    });

    if (!alert) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    // 2. Fetch latest density reading for the alert zone
    const targetReading = await prisma.densityReading.findFirst({
      where: { zoneId: alert.zoneId },
      orderBy: { recordedAt: 'desc' },
    });

    const targetPct = targetReading ? Math.round(parseFloat(targetReading.densityPct.toString()) * 100) : 100;
    const targetCount = targetReading ? targetReading.estimatedCount : alert.zone.maxCapacity;

    // 3. Fetch all other zones in the venue with their latest density readings to find alternative rerouting paths
    const otherZones = await prisma.zone.findMany({
      where: {
        venueId: alert.zone.venueId,
        NOT: { id: alert.zoneId },
      },
      include: {
        densityReadings: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    // 4. Compile adjacent zone stats and formulate the operational prompt
    const adjacentStatsText = buildAdjacentZoneStatsText(otherZones);
    const recommendationPrompt = buildReroutingPrompt(
      alert.zone,
      alert.severity,
      targetPct,
      targetCount,
      adjacentStatsText
    );

    // 5. Query Gemini
    const geminiResult = await askGemini(recommendationPrompt);

    // 6. Persist generated recommendation in database
    const updatedAlert = await prisma.alert.update({
      where: { id: alertId },
      data: {
        aiRecommendation: geminiResult.responseText,
      },
      include: {
        zone: true,
      },
    });

    res.status(200).json({
      alertId: updatedAlert.id,
      recommendation: updatedAlert.aiRecommendation,
    });
  } catch (error) {
    console.error('Error generating AI recommendation:', error);
    res.status(500).json({ error: 'Failed to generate AI recommendation' });
  }
});

export default router;
