import { Router } from 'express';
import { getAppMode, getSiteStatus } from '../controllers/systemController.js';

const router = Router();

router.get('/mode', getAppMode);
router.get('/sites', getSiteStatus);

export default router;
