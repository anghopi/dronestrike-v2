import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const usersRouter = Router();

usersRouter.use(authenticateJWT);

usersRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Users endpoint - Coming soon',
    data: [],
  });
});