import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.js';

export const leadsRouter = Router();

// All lead routes require authentication
leadsRouter.use(authenticateJWT);

/**
 * GET /api/leads
 * Get all leads with filtering and pagination
 */
leadsRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Leads endpoint - Coming soon',
    data: [],
  });
});

/**
 * POST /api/leads
 * Create new lead
 */
leadsRouter.post('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Create lead endpoint - Coming soon',
    data: null,
  });
});