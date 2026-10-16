import { Router } from 'express';
import { dbState } from '../config/db.js';

const router = Router();

// GET /api/health — quick check that the API and database are up
router.get('/', (req, res) => {
  const db = dbState();
  res.status(db === 'connected' ? 200 : 503).json({
    success: db === 'connected',
    service: 'certiflow-api',
    database: db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
