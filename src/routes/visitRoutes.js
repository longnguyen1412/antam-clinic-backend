import { Router } from 'express';
import {
  getVisits,
  getVisitDetail,
  createLuotKham,
  updateLuotKham,
  addDiagnosis,
  createLuotChua,
  updateLuotChua,
  stopTreatmentDot,
  deleteVisit,
} from '../controllers/visitController.js';

const router = Router();

// Lượt chung
router.get('/luot', getVisits);
router.get('/luot/:maLuot', getVisitDetail);
router.delete('/luot/:maLuot', deleteVisit);

// Phiếu khám
router.post('/luot-kham', createLuotKham);
router.put('/luot-kham/:maLuot', updateLuotKham);
router.post('/luot-kham/:maLuot/chan-doan', addDiagnosis);

// Phiếu điều trị
router.post('/luot-chua', createLuotChua);
router.put('/luot-chua/:maLuot', updateLuotChua);

// Đợt điều trị
router.put('/dot-dieu-tri/:maCDDT/ngung', stopTreatmentDot);

export default router;

