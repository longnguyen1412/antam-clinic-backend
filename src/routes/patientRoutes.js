import { Router } from 'express';
import {
  getPatients,
  getPatientReception,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientMedicalRecord,
  getActiveTreatmentDots,
} from '../controllers/patientController.js';
import { getPhieuKhamGoc } from '../controllers/visitController.js';

const router = Router();

router.get('/tiep-don', getPatientReception);
router.get('/:maBN/ho-so', getPatientMedicalRecord);
router.get('/:maBN/dot-dang-dieu-tri', getActiveTreatmentDots);
router.get('/:maBN/phieu-kham-goc', getPhieuKhamGoc);
router.get('/', getPatients);
router.post('/', createPatient);
router.put('/:maBN', updatePatient);
router.delete('/:maBN', deletePatient);

export default router;

