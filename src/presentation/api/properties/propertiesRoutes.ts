import { Router } from 'express';
import { authenticateJWT, requireOfficerOrAdmin } from '../../middleware/auth.js';

export const propertiesRouter = Router();

// All property routes require authentication
propertiesRouter.use(authenticateJWT);

/**
 * GET /api/properties
 * Get all properties with pagination and filtering
 */
propertiesRouter.get('/', async (req, res) => {
  res.json({
    success: true,
    message: 'Properties endpoint - Coming soon',
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
    },
  });
});

/**
 * GET /api/properties/:id
 * Get specific property
 */
propertiesRouter.get('/:id', async (req, res) => {
  res.json({
    success: true,
    message: 'Property detail endpoint - Coming soon',
    data: null,
  });
});

/**
 * POST /api/properties
 * Create new property (officers and admins only)
 */
propertiesRouter.post('/', requireOfficerOrAdmin, async (req, res) => {
  res.json({
    success: true,
    message: 'Create property endpoint - Coming soon',
    data: null,
  });
});