/**
 * RexaCloud Authentication & Authorization Middleware
 * Verifies Bearer session tokens against persistent SQLite database and validates user roles.
 * Never trusts client-supplied role parameters.
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { User } from '@/shared/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected Bearer token.',
    });
  }

  const user = authService.validateToken(token);

  if (!user) {
    return res.status(401).json({
      error: 'Invalid session',
      message: 'Session has expired or token is invalid. Please sign in again.',
    });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Administrative privileges required for this operation.',
    });
  }

  next();
}
