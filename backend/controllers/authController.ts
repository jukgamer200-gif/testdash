/**
 * RexaCloud Authentication Controller
 * Handles user login, profile retrieval, session logout, and user provisioning.
 * Enforces rate limiting against brute-force attacks and rejects invalid credentials.
 */

import { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import { auditService } from '../services/auditService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const authController = {
  login(req: Request, res: Response) {
    const { username, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Rate-limiting defense against brute-force attacks
    const rateLimitKey = `${clientIp}:${username.toLowerCase()}`;
    const rateLimit = authService.checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many failed login attempts.',
        message: `Account temporarily locked for security. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
      });
    }

    const dbUser = authService.findDbUserByUsernameOrEmail(username);
    if (!dbUser) {
      authService.recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ error: 'Invalid credentials. Please verify your username and password.' });
    }

    const isValid = authService.verifyPassword(dbUser, password);
    if (!isValid) {
      authService.recordFailedAttempt(rateLimitKey);
      auditService.log({
        userId: dbUser.id,
        username: dbUser.username,
        action: 'AUTH_FAILED',
        resource: 'Account Login',
        details: 'Failed password verification',
        status: 'error',
        ip: clientIp,
      });
      return res.status(401).json({ error: 'Invalid credentials. Please verify your username and password.' });
    }

    // Clear failed attempts on success
    authService.clearFailedAttempts(rateLimitKey);

    const safeUser = {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role,
      pterodactylId: dbUser.pterodactyl_id ?? undefined,
      avatarUrl: dbUser.avatar_url ?? undefined,
      createdAt: dbUser.created_at,
    };

    const session = authService.createSession(safeUser, clientIp, req.headers['user-agent']);

    auditService.log({
      userId: safeUser.id,
      username: safeUser.username,
      action: 'AUTH_LOGIN',
      resource: 'Session',
      details: `Successful sign-in as ${safeUser.role}`,
      status: 'success',
      ip: clientIp,
    });

    return res.json({
      message: 'Authentication successful',
      session,
    });
  },

  signup(req: Request, res: Response) {
    const { username, email, password } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
      const { user, session } = authService.registerCustomer({ username, email, password });

      auditService.log({
        userId: user.id,
        username: user.username,
        action: 'USER_SIGNUP',
        resource: 'Account Registration',
        details: `Customer self-registration: ${user.username}`,
        status: 'success',
        ip: clientIp,
      });

      return res.status(201).json({
        message: 'Account created successfully',
        session,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Registration failed' });
    }
  },

  getCurrentUser(req: AuthenticatedRequest, res: Response) {
    return res.json({ user: req.user });
  },

  logout(req: AuthenticatedRequest, res: Response) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      authService.destroySession(authHeader.substring(7));
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  },

  listUsers(req: AuthenticatedRequest, res: Response) {
    const users = authService.getAllUsers();
    return res.json({ users });
  },

  createUser(req: AuthenticatedRequest, res: Response) {
    const { username, email, role, password } = req.body;
    if (!username || !email || !role || !password) {
      return res.status(400).json({ error: 'Username, email, role, and password are required' });
    }

    try {
      let newUser;
      if (role === 'admin') {
        newUser = authService.createAdminUser({ username, email, password });
      } else {
        const result = authService.registerCustomer({ username, email, password });
        newUser = result.user;
      }

      auditService.log({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'USER_CREATE',
        resource: newUser.username,
        details: `Created new user ${newUser.username} (${newUser.role})`,
        status: 'success',
      });

      return res.status(201).json({ user: newUser });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to create user' });
    }
  },

  deleteUser(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own administrator account' });
    }

    authService.deleteUser(id);

    auditService.log({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'USER_DELETE',
      resource: `User ID ${id}`,
      details: 'Administrator removed user account',
      status: 'warning',
    });

    return res.json({ success: true, message: 'User removed successfully' });
  },
};
