import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { 
  authenticateJWT, 
  generateJWTToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  AuthenticatedRequest 
} from '../../middleware/auth.js';
import { UserEntity, UserRole } from '../../../domain/entities/User.js';
import { logger, logSecurityEvent, logInfo } from '../../../infrastructure/monitoring/logger.js';

export const authRouter = Router();

// Validation rules
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required'),
];

const registerValidation = [
  body('username').isLength({ min: 3, max: 50 }).withMessage('Username must be 3-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').isLength({ min: 1, max: 100 }).withMessage('First name is required'),
  body('lastName').isLength({ min: 1, max: 100 }).withMessage('Last name is required'),
  body('role').isIn(['admin', 'officer', 'soldier', 'client']).withMessage('Valid role is required'),
];

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
authRouter.post('/login', loginValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { email, password } = req.body;

    // TODO: Implement actual user lookup from database
    // For now, create a mock user for demonstration
    const mockUser = await UserEntity.create({
      username: 'demo',
      email: 'demo@example.com',
      password: 'demo123',
      firstName: 'Demo',
      lastName: 'User',
      role: 'officer' as UserRole,
    });

    // Verify password
    const isPasswordValid = await mockUser.verifyPassword(password);
    if (!isPasswordValid || email !== 'demo@example.com') {
      logSecurityEvent('Failed login attempt', undefined, {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString(),
      });
    }

    // Generate tokens
    const accessToken = generateJWTToken({
      id: 1, // Mock ID
      email: mockUser.email,
      username: mockUser.username,
      role: mockUser.role,
      isActive: mockUser.isActive,
    });

    const refreshToken = generateRefreshToken(1);

    logInfo('User logged in successfully', {
      userId: 1,
      email: mockUser.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: mockUser.toPublic(),
      accessToken,
      refreshToken,
      expiresIn: '24h',
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user (admin only for now)
 */
authRouter.post('/register', registerValidation, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
        timestamp: new Date().toISOString(),
      });
    }

    const { username, email, password, firstName, lastName, role } = req.body;

    // TODO: Check if user already exists in database
    // TODO: Implement actual user creation in database

    // Create user entity
    const user = await UserEntity.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: role as UserRole,
    });

    logInfo('New user registered', {
      username,
      email,
      role,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: user.toPublic(),
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN',
        timestamp: new Date().toISOString(),
      });
    }

    const tokenData = verifyRefreshToken(refreshToken);
    if (!tokenData) {
      logSecurityEvent('Invalid refresh token used', undefined, {
        ip: req.ip,
      });

      return res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Fetch user from database
    // For now, use mock data
    const accessToken = generateJWTToken({
      id: tokenData.userId,
      email: 'demo@example.com',
      username: 'demo',
      role: 'officer',
      isActive: true,
    });

    res.json({
      success: true,
      accessToken,
      expiresIn: '24h',
    });

  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user information
 */
authRouter.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'User not authenticated',
        code: 'NOT_AUTHENTICATED',
        timestamp: new Date().toISOString(),
      });
    }

    // TODO: Fetch fresh user data from database
    // For now, return data from JWT
    res.json({
      success: true,
      user: req.user,
    });

  } catch (error) {
    logger.error('Get user info error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (invalidate refresh token)
 */
authRouter.post('/logout', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    // TODO: Implement refresh token blacklist/invalidation
    
    logInfo('User logged out', {
      userId: req.user?.id,
      email: req.user?.email,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });

  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify JWT token validity
 */
authRouter.get('/verify', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    valid: true,
    user: req.user,
    timestamp: new Date().toISOString(),
  });
});