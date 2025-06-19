import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const documentsRouter = Router();

documentsRouter.use(authenticateJWT);

documentsRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Documents endpoint - Coming soon',
    data: [],
  });
});