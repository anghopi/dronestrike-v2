import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const missionsRouter = Router();

// All mission routes require authentication
missionsRouter.use(authenticateJWT);

/**
 * GET /api/missions
 * Get missions (filtered by user role)
 */
missionsRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Missions endpoint - Coming soon',
    data: [],
  });
});