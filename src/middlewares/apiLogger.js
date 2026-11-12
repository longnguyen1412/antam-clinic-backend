import { publishEvent, TOPICS } from '../services/kafkaService.js';
import { env } from '../config/env.js';

/**
 * Common Middleware: Logs every API request/response and publishes to Kafka asynchronously.
 * Completely non-blocking and safe from failures.
 */
export function apiLogger(req, res, next) {
  // Only monitor API calls (ignore static files)
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  const startTime = Date.now();

  // Hook into response finish event
  res.on('finish', () => {
    try {
      const durationMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const isError = statusCode >= 400;

      // Extract error details if attached by errorHandler
      const err = res.locals.error;
      const errorMessage = err ? (err.message || String(err)) : (isError ? res.statusMessage : null);
      const errorStack = err ? err.stack : null;
      const errorCode = err ? (err.code || null) : null;

      // Normalize route pattern (e.g., /api/hoa-don/HD-123 -> /api/hoa-don/:id)
      let routePath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.path;
      if (req.route && req.route.path) {
        routePath = req.baseUrl ? `${req.baseUrl}${req.route.path}` : req.route.path;
      }

      const logPayload = {
        requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        site: req.site || env.siteCode,
        siteName: env.siteName,
        method: req.method,
        url: req.originalUrl,
        route: routePath || req.originalUrl.split('?')[0],
        statusCode,
        durationMs,
        isError,
        errorMessage,
        errorStack,
        errorCode,
        clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip,
        userAgent: req.headers['user-agent'] || '',
        query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
        // Omit large/sensitive body payloads
        bodySnippet: req.body && Object.keys(req.body).length > 0
          ? sanitizeBody(req.body)
          : undefined,
      };

      // Publish to Kafka topic
      publishEvent(TOPICS.API_LOGS, logPayload);
    } catch (logErr) {
      // Safe fallback - never disrupt response
      console.warn('[API Logger Warning]', logErr.message);
    }
  });

  next();
}

/**
 * Sanitize request body (mask passwords, keep concise)
 */
function sanitizeBody(body) {
  if (typeof body !== 'object' || body === null) return body;
  const clone = Array.isArray(body) ? [...body] : { ...body };
  if (!Array.isArray(clone)) {
    ['password', 'matKhau', 'token', 'secret'].forEach((k) => {
      if (clone[k]) clone[k] = '***';
    });
  }
  return clone;
}

