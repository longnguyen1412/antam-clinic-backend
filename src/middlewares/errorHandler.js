/**
 * Centralized error handling middleware.
 * Maps PostgreSQL error codes to friendly JSON responses.
 */
export function errorHandler(err, req, res, next) {
  const site = req.site || null;

  // PostgreSQL Error Codes mapping
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          status: 409,
          code: 'UNIQUE_VIOLATION',
          message: 'Dữ liệu đã tồn tại (vi phạm ràng buộc UNIQUE).',
          detail: err.detail,
          site,
          sqlState: err.code,
        });

      case '23514': // check_violation
        return res.status(400).json({
          status: 400,
          code: 'CHECK_VIOLATION',
          message: 'Giá trị không hợp lệ (vi phạm ràng buộc CHECK).',
          detail: err.detail,
          constraint: err.constraint,
          site,
          sqlState: err.code,
        });

      case '23503': // foreign_key_violation
        return res.status(400).json({
          status: 400,
          code: 'FOREIGN_KEY_VIOLATION',
          message: 'Dữ liệu tham chiếu không tồn tại (vi phạm khóa ngoại).',
          detail: err.detail,
          site,
          sqlState: err.code,
        });

      case '23502': // not_null_violation
        return res.status(400).json({
          status: 400,
          code: 'NOT_NULL_VIOLATION',
          message: `Trường dữ liệu bắt buộc bị thiếu: ${err.column}`,
          site,
          sqlState: err.code,
        });

      case 'P0001': // raise_exception from triggers
        return res.status(400).json({
          status: 400,
          code: 'BUSINESS_RULE_VIOLATION',
          message: err.message,
          site,
          sqlState: err.code,
        });
    }
  }

  const statusCode = err.status || err.statusCode || 500;
  console.error('[Unhandled Error]', err);

  return res.status(statusCode).json({
    status: statusCode,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Đã có lỗi xảy ra trên hệ thống.',
    site,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
