import { Router } from 'express';

const router = Router();

// GET /api/v1/health - Returns service health status
router.get('/', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

export default router;
