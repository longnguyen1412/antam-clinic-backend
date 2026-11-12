import { getMongoDb, isMongoConnected } from '../config/mongodb.js';
import { isKafkaConnected } from '../services/kafkaService.js';
import { syncAllInvoicesToMongo } from '../services/invoiceSyncService.js';

// ============================================================================
// 1. THỐNG KÊ LOG API (Truy vấn hoàn toàn trên MongoDB api_logs)
// ============================================================================

/**
 * Tổng quan thống kê gọi API (Số lượt gọi, số lỗi, tỉ lệ lỗi, thời gian phản hồi)
 * GET /api/analytics/api-logs/overview
 */
export async function getApiOverview(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) {
      return res.json({
        status: 'MONGO_DISCONNECTED',
        kafkaConnected: isKafkaConnected(),
        mongoConnected: false,
        totalCalls: 0,
        totalErrors: 0,
        errorRate: 0,
        avgDurationMs: 0,
        statusBreakdown: { '2xx': 0, '4xx': 0, '5xx': 0 },
        methodBreakdown: {},
      });
    }

    const coll = db.collection('api_logs');

    // Aggregate statistics
    const [stats] = await coll.aggregate([
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalErrors: { $sum: { $cond: ['$isError', 1, 0] } },
          totalDuration: { $sum: '$durationMs' },
          status2xx: { $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 200] }, { $lt: ['$statusCode', 300] }] }, 1, 0] } },
          status4xx: { $sum: { $cond: [{ $and: [{ $gte: ['$statusCode', 400] }, { $lt: ['$statusCode', 500] }] }, 1, 0] } },
          status5xx: { $sum: { $cond: [{ $gte: ['$statusCode', 500] }, 1, 0] } },
        },
      },
    ]).toArray();

    // Group by method
    const methods = await coll.aggregate([
      { $group: { _id: '$method', count: { $sum: 1 } } },
    ]).toArray();

    const methodMap = {};
    methods.forEach((m) => { if (m._id) methodMap[m._id] = m.count; });

    const totalCalls = stats?.totalCalls || 0;
    const totalErrors = stats?.totalErrors || 0;
    const avgDurationMs = totalCalls > 0 ? Math.round(stats.totalDuration / totalCalls) : 0;
    const errorRate = totalCalls > 0 ? parseFloat(((totalErrors / totalCalls) * 100).toFixed(2)) : 0;

    res.json({
      status: 'OK',
      kafkaConnected: isKafkaConnected(),
      mongoConnected: true,
      totalCalls,
      totalErrors,
      errorRate,
      avgDurationMs,
      statusBreakdown: {
        '2xx': stats?.status2xx || 0,
        '4xx': stats?.status4xx || 0,
        '5xx': stats?.status5xx || 0,
      },
      methodBreakdown: methodMap,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Danh sách log API gần đây (có lọc theo lỗi, method, route)
 * GET /api/analytics/api-logs/recent
 */
export async function getRecentApiLogs(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) {
      return res.json({ data: [], total: 0 });
    }

    const { isError, method, q, limit = 50, skip = 0 } = req.query;
    const filter = {};

    if (isError === 'true') filter.isError = true;
    if (isError === 'false') filter.isError = false;
    if (method) filter.method = method.toUpperCase();
    if (q) {
      filter.$or = [
        { url: { $regex: q, $options: 'i' } },
        { errorMessage: { $regex: q, $options: 'i' } },
      ];
    }

    const coll = db.collection('api_logs');
    const total = await coll.countDocuments(filter);
    const data = await coll
      .find(filter)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip, 10))
      .limit(Math.min(parseInt(limit, 10), 100))
      .toArray();

    res.json({ data, total });
  } catch (err) {
    next(err);
  }
}

/**
 * Top API có thời gian xử lý chậm nhất
 * GET /api/analytics/api-logs/top-slow
 */
export async function getTopSlowApis(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return res.json([]);

    const coll = db.collection('api_logs');
    const topSlow = await coll.aggregate([
      {
        $group: {
          _id: { route: '$route', method: '$method' },
          count: { $sum: 1 },
          avgDurationMs: { $avg: '$durationMs' },
          maxDurationMs: { $max: '$durationMs' },
          minDurationMs: { $min: '$durationMs' },
        },
      },
      { $sort: { avgDurationMs: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          route: '$_id.route',
          method: '$_id.method',
          count: 1,
          avgDurationMs: { $round: ['$avgDurationMs', 1] },
          avgDuration: { $round: ['$avgDurationMs', 1] },
          maxDurationMs: 1,
          maxDuration: '$maxDurationMs',
          minDurationMs: 1,
          minDuration: '$minDurationMs',
        },
      },
    ]).toArray();

    res.json(topSlow);
  } catch (err) {
    next(err);
  }
}

/**
 * Top API phát sinh nhiều lỗi nhất
 * GET /api/analytics/api-logs/top-errors
 */
export async function getTopErrorApis(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return res.json([]);

    const coll = db.collection('api_logs');
    const topErrors = await coll.aggregate([
      { $match: { isError: true } },
      {
        $group: {
          _id: { route: '$route', method: '$method', statusCode: '$statusCode', errorMessage: '$errorMessage' },
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          route: '$_id.route',
          method: '$_id.method',
          statusCode: '$_id.statusCode',
          errorMessage: '$_id.errorMessage',
          count: 1,
          lastOccurred: 1,
        },
      },
    ]).toArray();

    res.json(topErrors);
  } catch (err) {
    next(err);
  }
}


// ============================================================================
// 2. THỐNG KÊ BẢN SAO HÓA ĐƠN TRÊN MONGODB (GIẢM TẢI DB CHÍNH)
// ============================================================================

/**
 * Tổng quan doanh thu & viện phí từ MongoDB
 * GET /api/analytics/invoices/overview
 */
export async function getInvoiceOverview(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) {
      return res.json({
        status: 'MONGO_DISCONNECTED',
        totalInvoices: 0,
        tongTien: 0,
        giamTru: 0,
        phaiTra: 0,
        daThanhToan: 0,
        conThieu: 0,
        tyLeThuHoi: 0,
        trangThaiBreakdown: {},
      });
    }

    const coll = db.collection('invoice_replicas');

    const [stats] = await coll.aggregate([
      {
        $group: {
          _id: null,
          totalInvoices: { $sum: 1 },
          tongTien: { $sum: '$tongTien' },
          giamTru: { $sum: '$giamTru' },
          phaiTra: { $sum: '$soTienPhaiTra' },
          daThanhToan: { $sum: '$daThanhToan' },
          conThieu: { $sum: '$conThieu' },
          daThuHetCount: { $sum: { $cond: ['$isDaThuHet', 1, 0] } },
          chuaThuHetCount: { $sum: { $cond: ['$isDaThuHet', 0, 1] } },
        },
      },
    ]).toArray();

    // Group by status
    const statuses = await coll.aggregate([
      { $group: { _id: '$trangThai', count: { $sum: 1 }, tongTien: { $sum: '$soTienPhaiTra' } } },
    ]).toArray();

    const trangThaiMap = {};
    statuses.forEach((s) => {
      if (s._id) trangThaiMap[s._id] = { count: s.count, tongTien: s.tongTien };
    });

    const phaiTra = stats?.phaiTra || 0;
    const daThanhToan = stats?.daThanhToan || 0;
    const tyLeThuHoi = phaiTra > 0 ? parseFloat(((daThanhToan / phaiTra) * 100).toFixed(2)) : 0;

    res.json({
      status: 'OK',
      totalInvoices: stats?.totalInvoices || 0,
      tongTien: stats?.tongTien || 0,
      giamTru: stats?.giamTru || 0,
      phaiTra,
      daThanhToan,
      conThieu: stats?.conThieu || 0,
      tyLeThuHoi,
      daThuHetCount: stats?.daThuHetCount || 0,
      chuaThuHetCount: stats?.chuaThuHetCount || 0,
      trangThaiBreakdown: trangThaiMap,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Thống kê doanh thu theo chi nhánh từ MongoDB
 * GET /api/analytics/invoices/by-branch
 */
export async function getInvoicesByBranch(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return res.json([]);

    const coll = db.collection('invoice_replicas');
    const branches = await coll.aggregate([
      {
        $group: {
          _id: '$site',
          siteName: { $first: '$siteName' },
          totalInvoices: { $sum: 1 },
          phaiTra: { $sum: '$soTienPhaiTra' },
          daThanhToan: { $sum: '$daThanhToan' },
          conThieu: { $sum: '$conThieu' },
        },
      },
      {
        $project: {
          _id: 0,
          site: '$_id',
          siteName: { $ifNull: ['$siteName', '$_id'] },
          totalInvoices: 1,
          phaiTra: 1,
          daThanhToan: 1,
          conThieu: 1,
          tyLeThu: {
            $cond: [
              { $gt: ['$phaiTra', 0] },
              { $round: [{ $multiply: [{ $divide: ['$daThanhToan', '$phaiTra'] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { phaiTra: -1 } },
    ]).toArray();

    res.json(branches);
  } catch (err) {
    next(err);
  }
}

/**
 * Thống kê cơ cấu hình thức thanh toán (Tiền mặt, Chuyển khoản, Thẻ)
 * GET /api/analytics/invoices/payment-methods
 */
export async function getPaymentMethodStats(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return res.json([]);

    const coll = db.collection('invoice_replicas');
    const methods = await coll.aggregate([
      { $unwind: '$lanThanhToan' },
      {
        $group: {
          _id: '$lanThanhToan.hinhThuc',
          soLuotThanhToan: { $sum: 1 },
          tongTienThu: { $sum: '$lanThanhToan.soTien' },
        },
      },
      {
        $project: {
          _id: 0,
          hinhThuc: '$_id',
          soLuotThanhToan: 1,
          tongTienThu: 1,
        },
      },
      { $sort: { tongTienThu: -1 } },
    ]).toArray();

    res.json(methods);
  } catch (err) {
    next(err);
  }
}

/**
 * Danh sách bệnh nhân còn nợ viện phí nhiều nhất (Top Công nợ)
 * GET /api/analytics/invoices/top-debtors
 */
export async function getTopDebtors(req, res, next) {
  try {
    const db = getMongoDb();
    if (!db || !isMongoConnected()) return res.json([]);

    const coll = db.collection('invoice_replicas');
    const debtors = await coll.aggregate([
      { $match: { conThieu: { $gt: 0 } } },
      {
        $group: {
          _id: '$maBN',
          tenBN: { $first: '$tenBN' },
          soDienThoai: { $first: '$soDienThoai' },
          soHoaDonNo: { $sum: 1 },
          tongNo: { $sum: '$conThieu' },
          tongPhaiTra: { $sum: '$soTienPhaiTra' },
          tongDaTra: { $sum: '$daThanhToan' },
        },
      },
      { $sort: { tongNo: -1 } },
      { $limit: 15 },
      {
        $project: {
          _id: 0,
          maBN: '$_id',
          tenBN: 1,
          soDienThoai: 1,
          soHoaDonNo: 1,
          tongNo: 1,
          tongPhaiTra: 1,
          tongDaTra: 1,
        },
      },
    ]).toArray();

    res.json(debtors);
  } catch (err) {
    next(err);
  }
}

/**
 * Kích hoạt đồng bộ toàn bộ hóa đơn từ PostgreSQL sang MongoDB
 * POST /api/analytics/invoices/sync-all
 */
export async function triggerBulkSync(req, res, next) {
  try {
    const result = await syncAllInvoicesToMongo();
    res.json({
      message: 'Đã gửi toàn bộ hóa đơn vào Kafka queue để đồng bộ sang MongoDB',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

