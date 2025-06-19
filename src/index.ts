import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

import { logger, morganStream, logInfo, logError } from './infrastructure/monitoring/logger.js';
import { checkDatabaseHealth, closeDatabaseConnection, getDatabaseInfo } from './infrastructure/database/connection.js';
import { setupApiRoutes } from './presentation/api/routes.js';
import { setupWebSocket } from './infrastructure/external/websocket.js';

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logError(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Create Express application
const app = express();
const PORT = process.env.API_PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// === SECURITY MIDDLEWARE ===
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: NODE_ENV === 'production',
}));

// === CORS CONFIGURATION ===
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// === RATE LIMITING ===
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW || '15')) * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// === BODY PARSING ===
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// === REQUEST LOGGING ===
if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
  app.use(morgan('combined', { stream: morganStream }));
}

// === HEALTH CHECK ENDPOINT ===
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const dbHealth = await checkDatabaseHealth();
    const dbInfo = getDatabaseInfo();
    
    const health = {
      status: 'healthy', // Always healthy in development
      timestamp: new Date().toISOString(),
      service: 'DroneStrike CRM v2',
      version: '2.0.0',
      environment: NODE_ENV,
      database: {
        status: dbHealth ? 'connected' : 'demo_mode',
        host: dbInfo.host,
        port: dbInfo.port,
        database: dbInfo.database,
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      responseTime: Date.now() - startTime,
    };
    
    res.status(200).json(health);
  } catch (error) {
    logError('Health check failed', error as Error);
    res.status(200).json({
      status: 'demo_mode',
      timestamp: new Date().toISOString(),
      service: 'DroneStrike CRM v2',
      version: '2.0.0',
      note: 'Running in demo mode without database',
    });
  }
});

// === API ROUTES ===
setupApiRoutes(app);

// === ERROR HANDLING ===
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logError('Unhandled error in request', err, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// === 404 HANDLER ===
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
});

// === SERVER STARTUP ===
async function startServer() {
  try {
    // Check database connection (optional in development)
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth) {
      logInfo('Database connection established', getDatabaseInfo());
    } else {
      logInfo('⚠️  Database not available - running in demo mode', {
        note: 'Some features will use mock data',
        environment: NODE_ENV,
      });
    }
    
    // Create HTTP server
    const server = createServer(app);
    
    // Setup WebSocket
    const wss = new WebSocketServer({ server });
    setupWebSocket(wss);
    
    // Start server
    server.listen(PORT, () => {
      logInfo(`🚀 DroneStrike CRM v2 API server started`, {
        port: PORT,
        environment: NODE_ENV,
        url: `http://localhost:${PORT}`,
        healthCheck: `http://localhost:${PORT}/health`,
        apiDocs: `http://localhost:${PORT}/api/docs`,
        websocket: `ws://localhost:${PORT}/ws`,
      });
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      logInfo(`Received ${signal}, starting graceful shutdown...`);
      
      try {
        server.close(async () => {
          logInfo('HTTP server closed');
          
          // Close database connection
          await closeDatabaseConnection();
          
          logInfo('Graceful shutdown completed');
          process.exit(0);
        });
        
        // Force exit after 30 seconds
        setTimeout(() => {
          logError('Forceful shutdown due to timeout');
          process.exit(1);
        }, 30000);
        
      } catch (error) {
        logError('Error during graceful shutdown', error as Error);
        process.exit(1);
      }
    };
    
    // Listen for shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logError('Failed to start server', error as Error);
    process.exit(1);
  }
}

// === UNHANDLED ERRORS ===
process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled rejection', new Error(String(reason)), { promise });
  process.exit(1);
});

// Start the server
startServer();