import { checkConnections } from '../config/database.js';

export async function getHealth(req, res, next) {
  try {
    const dbStatus = await checkConnections();
    const allUp = Object.values(dbStatus).every((s) => s.status === 'UP');

    res.status(allUp ? 200 : 503).json({
      status: allUp ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      databases: dbStatus,
    });
  } catch (err) {
    next(err);
  }
}
