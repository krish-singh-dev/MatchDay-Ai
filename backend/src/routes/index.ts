import { Router, Request, Response } from 'express';
import chatRoutes from './chat.routes';
import navigationRoutes from './navigation.routes';
import densityRoutes from './density.routes';
import alertsRoutes from './alerts.routes';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import { prisma } from '../config/db.client';

const apiRouter = Router();

// Mount sub-routers matching architecture.md routes
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/navigation', navigationRoutes);

/**
 * GET /api/v1/zones/:venueId
 * Returns all zones for a venue, each augmented with the most recent density reading.
 */
async function getZonesByVenue(req: Request, res: Response): Promise<void> {
  try {
    const { venueId } = req.params;
    const zones = await prisma.zone.findMany({
      where: { venueId },
      include: {
        densityReadings: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    const zonesWithLatestReading = zones.map((z) => {
      const reading = z.densityReadings[0];
      return {
        id: z.id,
        venueId: z.venueId,
        name: z.name,
        zoneType: z.zoneType,
        maxCapacity: z.maxCapacity,
        geoCoordinates: z.geoCoordinates,
        estimatedCount: reading ? reading.estimatedCount : 0,
        densityPct: reading ? parseFloat(reading.densityPct.toString()) : 0.0,
        recordedAt: reading ? reading.recordedAt : null,
      };
    });

    res.status(200).json(zonesWithLatestReading);
  } catch (error) {
    console.error('Error fetching zones:', error);
    res.status(500).json({ error: 'Failed to fetch zones' });
  }
}

// For /api/v1/zones/:venueId
const zonesRouter = Router();
zonesRouter.get('/:venueId', getZonesByVenue);
apiRouter.use('/zones', zonesRouter);

// For /api/v1/density/ingest
apiRouter.use('/density', densityRoutes);

// For /api/v1/alerts/*
apiRouter.use('/alerts', alertsRoutes);

// For /api/v1/auth/*
apiRouter.use('/auth', authRoutes);

// For /api/v1/health
apiRouter.use('/health', healthRoutes);

export default apiRouter;
