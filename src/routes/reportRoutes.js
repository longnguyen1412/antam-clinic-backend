import { Router } from 'express';
import {
  getThongKeBenh,
  getBangLuong,
  getDoanhThu,
  getTongQuan,
} from '../controllers/reportController.js';

const router = Router();

router.get('/thong-ke-benh', getThongKeBenh);
router.get('/luong', getBangLuong);
router.get('/doanh-thu', getDoanhThu);

export default router;
