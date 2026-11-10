import { Router } from 'express';
import {
  getBacSiToanChuoi,
  getYTaToanChuoi,
  getKhoaToanChuoi,
  getThietBiToanChuoi,
  getBenhNhanToanChuoiHq,
  getChiNhanhCoHoSo,
  getDoanhThuToanChuoi,
  getThongKeBenhToanChuoi,
} from '../controllers/hqController.js';
import { getPatientMedicalRecord } from '../controllers/patientController.js';

const router = Router();

router.get('/bac-si', getBacSiToanChuoi);
router.get('/y-ta', getYTaToanChuoi);
router.get('/khoa', getKhoaToanChuoi);
router.get('/thiet-bi', getThietBiToanChuoi);
router.get('/benh-nhan', getBenhNhanToanChuoiHq);
router.get('/benh-nhan/chi-nhanh', getChiNhanhCoHoSo);
router.get('/benh-nhan/:maBN/ho-so', getPatientMedicalRecord);
router.get('/doanh-thu', getDoanhThuToanChuoi);
router.get('/thong-ke-benh', getThongKeBenhToanChuoi);

export default router;
