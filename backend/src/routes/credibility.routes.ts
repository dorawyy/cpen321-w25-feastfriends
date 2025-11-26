import { Router } from 'express';
import { credibilityController } from '../controllers/credibility.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All credibility routes require authentication
router.use(authMiddleware);

/**
 * GET /api/credibility/code
 * Generate credibility code
 */
router.get('/code', credibilityController.generateCode.bind(credibilityController));

/**
 * POST /api/credibility/verify
 * Verify another user's code
 */
router.post('/verify', credibilityController.verifyCode.bind(credibilityController));

/**
 * POST /api/credibility/deduct
 * Deduct score when leaving without verification
 */
router.post('/deduct', credibilityController.deductScore.bind(credibilityController));

export default router;