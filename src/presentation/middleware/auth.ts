import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../../domain/entities/User.js';
import { logger, logSecurityEvent } from '../../infrastructure/monitoring/logger.js';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    username: string;
    role: UserRole;
    isActive: boolean;
  };
}

export interface JWTPayload {
  userId: number;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  iat: number;
  exp: number;
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      logSecurityEvent('Missing authentication token', undefined, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
      });
      
      res.status(401).json({
        error: 'Access token required',
        code: 'NO_TOKEN',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Check if user is active
    if (!decoded.isActive) {
      logSecurityEvent('Inactive user attempted access', decoded.userId, {
        email: decoded.email,
        ip: req.ip,
      });
      
      res.status(401).json({
        error: 'User account is inactive',
        code: 'USER_INACTIVE',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    // Attach user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      role: decoded.role,
      isActive: decoded.isActive,
    };
    
    next();
    
  } catch (error) {
    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid or expired token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorCode = 'INVALID_TOKEN';
      errorMessage = 'Invalid token format';
    }
    
    logSecurityEvent('JWT authentication failed', undefined, {
      error: errorMessage,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    
    res.status(401).json({
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (roles: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logSecurityEvent('Insufficient permissions', req.user.id, {
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        path: req.path,
      });
      
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString(),
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user is admin or officer
 */
export const requireOfficerOrAdmin = requireRole(['admin', 'officer']);

/**
 * Middleware to check if user can access resource (admin, officer, or owner)
 */
export const requireOwnershipOrElevated = (userIdField: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    // Admins and officers can access everything
    if (['admin', 'officer'].includes(req.user.role)) {
      next();
      return;
    }
    
    // Check ownership
    const resourceUserId = req.params[userIdField] || req.body[userIdField] || req.query[userIdField];
    
    if (resourceUserId && parseInt(resourceUserId) === req.user.id) {
      next();
      return;
    }
    
    logSecurityEvent('Unauthorized resource access attempt', req.user.id, {
      resourceUserId,
      path: req.path,
      method: req.method,
    });
    
    res.status(403).json({
      error: 'Access denied. You can only access your own resources.',
      code: 'ACCESS_DENIED',
      timestamp: new Date().toISOString(),
    });
  };
};

/**
 * Generate JWT token for user
 */
export function generateJWTToken(user: {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
  };
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    issuer: 'dronestrike-v2',
    audience: 'dronestrike-api',
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    JWT_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'dronestrike-v2',
      audience: 'dronestrike-api',
    }
  );
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return null;
    }
    
    return { userId: decoded.userId };
  } catch (error) {
    return null;
  }
}