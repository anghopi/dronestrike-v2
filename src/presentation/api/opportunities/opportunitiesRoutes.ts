import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const opportunitiesRouter = Router();

opportunitiesRouter.use(authenticateJWT);

opportunitiesRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Opportunities endpoint - Coming soon',
    data: [],
  });
});