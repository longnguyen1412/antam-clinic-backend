import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import masterDataRoutes from './masterDataRoutes.js';
import { siteContext } from '../middlewares/siteContext.js';

const router = Router();

// Health check doesn't need site context
router.use('/health', healthRoutes);

// Business & master routes with site context
router.use('/master', siteContext, masterDataRoutes);

export default router;
