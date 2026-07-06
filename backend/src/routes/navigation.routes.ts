import { Router, Request, Response } from 'express';
import { findRoute, STADIUM_ZONES } from '../config/stadiumGraph';

const router = Router();

// GET /api/v1/navigation/zones - Lists all zones with names and coordinates
router.get('/zones', (req: Request, res: Response) => {
  res.status(200).json(STADIUM_ZONES);
});

// POST /api/v1/navigation/route - Runs the pathfinding solver between start and end zones
router.post('/route', (req: Request, res: Response): void => {
  const { startZoneId, endZoneId } = req.body;

  if (!startZoneId || !endZoneId) {
    res.status(400).json({ error: 'Missing startZoneId or endZoneId parameters' });
    return;
  }

  const result = findRoute(startZoneId, endZoneId);
  if (!result) {
    res.status(404).json({ error: 'No route found between the selected zones' });
    return;
  }

  res.status(200).json(result);
});

export default router;
