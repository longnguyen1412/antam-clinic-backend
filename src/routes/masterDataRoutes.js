import { Router } from 'express';
import { getBranches, getMedicines, getServices } from '../controllers/masterDataController.js';

const router = Router();

router.get('/chi-nhanh', getBranches);
router.get('/thuoc', getMedicines);
router.get('/dich-vu', getServices);

export default router;
