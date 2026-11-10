import { env } from '../config/env.js';
import { pool } from '../config/database.js';

/**
 * Middleware gắn thông tin cơ sở hiện tại (1 BE <-> 1 DB)
 * - Gắn req.site = env.siteCode
 * - Gắn req.db = pool kết nối CSDL cục bộ
 * - Gắn Header X-Site vào response để client biết cơ sở đang phục vụ
 */
export function siteContext(req, res, next) {
  req.site = env.siteCode;
  req.db = pool;
  res.setHeader('X-Site', env.siteCode);
  next();
}
