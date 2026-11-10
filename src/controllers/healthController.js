import { checkConnection } from '../config/database.js';

export async function getHealth(req, res, next) {
  try {
    const dbStatus = await checkConnection();
    const isUp = dbStatus.status === 'UP';

    res.status(isUp ? 200 : 503).json({
      status: isUp ? 'UP' : 'DOWN',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    });
  } catch (err) {
    next(err);
  }
}
