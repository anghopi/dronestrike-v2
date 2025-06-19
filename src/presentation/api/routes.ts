import { Express } from 'express';
import { authRouter } from './auth/authRoutes.js';
import { propertiesRouter } from './properties/propertiesRoutes.js';
import { leadsRouter } from './leads/leadsRoutes.js';
import { missionsRouter } from './missions/missionsRoutes.js';
import { opportunitiesRouter } from './opportunities/opportunitiesRoutes.js';
import { usersRouter } from './users/usersRoutes.js';
import { documentsRouter } from './documents/documentsRoutes.js';
import { analyticsRouter } from './analytics/analyticsRoutes.js';
import { logger } from '../../infrastructure/monitoring/logger.js';

/**
 * Setup all API routes
 */
export function setupApiRoutes(app: Express): void {
  logger.info('🔗 Setting up API routes...');
  
  // === AUTHENTICATION ===
  app.use('/api/auth', authRouter);
  
  // === CORE BUSINESS ENTITIES ===
  app.use('/api/properties', propertiesRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/missions', missionsRouter);
  app.use('/api/opportunities', opportunitiesRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/documents', documentsRouter);
  
  // === ANALYTICS & REPORTING ===
  app.use('/api/analytics', analyticsRouter);
  
  // === API INFO ENDPOINT ===
  app.get('/api', (req, res) => {
    res.json({
      service: 'DroneStrike CRM v2 API',
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: '/api/auth',
        properties: '/api/properties',
        leads: '/api/leads',
        missions: '/api/missions',
        opportunities: '/api/opportunities',
        users: '/api/users',
        documents: '/api/documents',
        analytics: '/api/analytics',
        health: '/health',
      },
      documentation: '/api/docs',
    });
  });
  
  logger.info('✅ API routes configured successfully');
}