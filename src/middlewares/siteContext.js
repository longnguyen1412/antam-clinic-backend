import { getPool, pools } from '../config/database.js';
import { env } from '../config/env.js';

/**
 * Middleware that determines the target database site based on:
 * 1. Request header 'X-Site' (case-insensitive)
 * 2. Query param '?site=...'
 * 3. Default fallback site (S1)
 *
 * Attaches to req:
 * - req.site: string ('S0', 'S1', 'S2', 'S3')
 * - req.db: pg.Pool instance
 */
export function siteContext(req, res, next) {
  const headerSite = req.headers['x-site'];
  const querySite = req.query.site;
  const site = (headerSite || querySite || env.defaultSite).toString().toUpperCase();

  if (!pools[site]) {
    return res.status(400).json({
      status: 400,
      code: 'INVALID_SITE',
      message: `Mã chi nhánh '${site}' không hợp lệ. Các site hỗ trợ: ${Object.keys(pools).join(', ')}`,
    });
  }

  req.site = site;
  req.db = getPool(site);
  next();
}
