import { Router } from 'express';
import { env } from '../config/env.js';
import {
  getApiOverview,
  getRecentApiLogs,
  getTopSlowApis,
  getTopErrorApis,
  getInvoiceOverview,
  getInvoicesByBranch,
  getPaymentMethodStats,
  getTopDebtors,
  triggerBulkSync,
} from '../controllers/analyticsController.js';

const router = Router();

// Chức năng Thống kê MongoDB & Kafka chỉ khả dụng tại Site Trung tâm (S0)
router.use((req, res, next) => {
  const isCentral = env.siteCode === 'S0' || process.env.ENABLE_ANALYTICS_CONSUMER === 'true';
  if (!isCentral) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Hệ thống Thống kê MongoDB & Kafka được đặt tại Site Trung tâm (S0). Vui lòng truy cập từ máy chủ Trung tâm.',
      currentSite: env.siteCode,
      hubSite: 'S0',
    });
  }
  next();
});

// 1. API Log Analytics
router.get('/api-logs/overview', getApiOverview);
router.get('/api-logs/recent', getRecentApiLogs);
router.get('/api-logs/top-slow', getTopSlowApis);
router.get('/api-logs/top-errors', getTopErrorApis);

// 2. Invoice Replica Analytics (MongoDB)
router.get('/invoices/overview', getInvoiceOverview);
router.get('/invoices/by-branch', getInvoicesByBranch);
router.get('/invoices/payment-methods', getPaymentMethodStats);
router.get('/invoices/top-debtors', getTopDebtors);
router.post('/invoices/sync-all', triggerBulkSync);

export default router;

