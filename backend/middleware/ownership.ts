/**
 * RexaCloud Server Ownership & Access Verification Middleware
 * Ensures customers can only inspect and manage servers they legitimately own or have access grants for.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import { authService } from '../services/authService.js';

export function verifyServerAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Administrators have global authority across all servers
  if (req.user.role === 'admin') {
    return next();
  }

  const serverId = req.params.server || req.params.identifier || req.body?.serverId;
  if (!serverId) {
    return res.status(400).json({ error: 'Missing server identifier in request' });
  }

  const allowedServers = authService.getUserServerIds(req.user.id);
  if (allowedServers.includes('*') || allowedServers.includes(serverId)) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied',
    message: `You do not have permission to manage server: ${serverId}`,
  });
}
