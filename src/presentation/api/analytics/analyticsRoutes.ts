import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.use(authenticateJWT);

analyticsRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Analytics endpoint - Coming soon',
    data: [],
  });
});