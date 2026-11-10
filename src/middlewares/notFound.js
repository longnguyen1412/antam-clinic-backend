export function notFound(req, res) {
  res.status(404).json({
    status: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `Không tìm thấy tài nguyên: ${req.method} ${req.originalUrl}`,
  });
}
