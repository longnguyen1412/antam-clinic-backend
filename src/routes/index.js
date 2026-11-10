import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import masterDataRoutes from './masterDataRoutes.js';
import { siteContext } from '../middlewares/siteContext.js';

const router = Router();

// Apply site context middleware to all /api endpoints
router.use(siteContext);

// Route modules
router.use('/health', healthRoutes);
router.use('/master', masterDataRoutes);

export default router;
