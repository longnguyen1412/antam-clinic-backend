import { env } from '../config/env.js';
import { pool } from '../config/database.js';

/**
 * Middleware gắn thông tin cơ sở hiện tại (1 BE <-> 1 DB)
 * - Gắn req.site = env.siteCode
 * - Gắn req.db = pool kết nối CSDL cục bộ
 * - Gắn Header X-Site vào response
 * - Kiểm tra nếu client gửi X-Site khác với site của backend thì cảnh báo
 */
export function siteContext(req, res, next) {
  req.site = env.siteCode;
  req.db = pool;
  res.setHeader('X-Site', env.siteCode);

  const headerSite = req.headers['x-site'];
  if (headerSite && headerSite.toUpperCase() !== env.siteCode) {
    return res.status(400).json({
      status: 400,
      code: 'SITE_MISMATCH',
      message: `Backend này thuộc cơ sở ${env.siteCode} (${env.siteName}), không phục vụ yêu cầu của cơ sở '${headerSite}'. Vui lòng gửi yêu cầu đến đúng máy chủ của cơ sở đó.`,
      currentSite: env.siteCode,
      requestedSite: headerSite.toUpperCase(),
    });
  }

  next();
}
