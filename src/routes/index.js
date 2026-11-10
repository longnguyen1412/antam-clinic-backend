import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import systemRoutes from './systemRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import patientRoutes from './patientRoutes.js';
import visitRoutes from './visitRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import reportRoutes from './reportRoutes.js';
import hqRoutes from './hqRoutes.js';
import { getTongQuan } from '../controllers/reportController.js';

const router = Router();

// 1. Health check & System info
router.use('/health', healthRoutes);
router.use('/system', systemRoutes);

// 2. Catalogs (branch & master)
router.use('/', catalogRoutes);

// 3. Patients (tiếp đón & hồ sơ)
router.use('/benh-nhan', patientRoutes);

// 4. Clinical workflow (phiếu khám, phiếu điều trị, đợt điều trị)
router.use('/', visitRoutes);

// 5. Invoices & Payments (hóa đơn & thanh toán)
router.use('/hoa-don', invoiceRoutes);

// 6. Reports & Summary (báo cáo & tổng quan)
router.use('/bao-cao', reportRoutes);
router.get('/tong-quan', getTongQuan);

// 7. Headquarters S0 views
router.use('/hq', hqRoutes);

export default router;
