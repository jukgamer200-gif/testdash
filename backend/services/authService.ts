/**
 * RexaCloud Authentication Service
 * Manages accounts, sessions, password validation, and user role claims using persistent SQLite database.
 * No hardcoded demo accounts. Strictly validates credentials.
 */

import crypto from 'crypto';
import { User, AuthSession } from '@/shared/types';
import { dbUsers, dbSessions, dbGrants, DbUser } from '../db/index.js';

// Cryptographic password hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// Convert DbUser to client-safe User object
function toSafeUser(dbUser: DbUser): User {
  return {
    id: dbUser.id,
    username: dbUser.username,
    email: dbUser.email,
    role: dbUser.role,
    pterodactylId: dbUser.pterodactyl_id ?? undefined,
    avatarUrl: dbUser.avatar_url ?? undefined,
    createdAt: dbUser.created_at,
  };
}

// In-memory rate limiting map for brute-force defense
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

export const authService = {
  checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const entry = failedAttempts.get(key);
    if (!entry) return { allowed: true };

    if (now > entry.resetAt) {
      failedAttempts.delete(key);
      return { allowed: true };
    }

    if (entry.count >= 5) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  },

  recordFailedAttempt(key: string) {
    const now = Date.now();
    const entry = failedAttempts.get(key);
    if (!entry || now > entry.resetAt) {
      failedAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 }); // 15 minute lock
    } else {
      entry.count += 1;
    }
  },

  clearFailedAttempts(key: string) {
    failedAttempts.delete(key);
  },

  findUserById(id: string): User | undefined {
    const u = dbUsers.getById(id);
    return u ? toSafeUser(u) : undefined;
  },

  findDbUserByUsernameOrEmail(usernameOrEmail: string): DbUser | undefined {
    return dbUsers.getByUsernameOrEmail(usernameOrEmail);
  },

  verifyPassword(user: DbUser, password: string): boolean {
    return verifyPasswordHash(password, user.password_hash);
  },

  getAllUsers(): User[] {
    return dbUsers.getAll().map(toSafeUser);
  },

  getUserCount(): number {
    return dbUsers.count();
  },

  createSession(user: User, ipAddress?: string, userAgent?: string): AuthSession {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresInMs = 7 * 24 * 60 * 60 * 1000; // 7 days session
    const expiresAt = Date.now() + expiresInMs;

    dbSessions.create(token, user.id, expiresAt, ipAddress, userAgent);

    return {
      token,
      user,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  },

  validateToken(token: string | null): User | null {
    if (!token) return null;
    const session = dbSessions.get(token);
    if (!session) return null;
    return toSafeUser(session.user);
  },

  destroySession(token: string) {
    dbSessions.delete(token);
  },

  registerCustomer(data: { username: string; email: string; password: string }): {
    user: User;
    session: AuthSession;
  } {
    const existing = dbUsers.getByUsernameOrEmail(data.username) || dbUsers.getByUsernameOrEmail(data.email);
    if (existing) {
      throw new Error('An account with this username or email already exists.');
    }

    const userId = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = hashPassword(data.password);

    const newUser = dbUsers.create({
      id: userId,
      username: data.username.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash,
      role: 'customer', // Public signup strictly restricted to customer
      pterodactylId: null,
      avatarUrl: null,
    });

    const safeUser = toSafeUser(newUser);
    const session = this.createSession(safeUser);
    return { user: safeUser, session };
  },

  createAdminUser(data: { username: string; email: string; password: string }): User {
    const existing = dbUsers.getByUsernameOrEmail(data.username) || dbUsers.getByUsernameOrEmail(data.email);
    if (existing) {
      throw new Error(`User with username "${data.username}" or email "${data.email}" already exists.`);
    }

    const userId = `adm-${crypto.randomBytes(8).toString('hex')}`;
    const passwordHash = hashPassword(data.password);

    const newAdmin = dbUsers.create({
      id: userId,
      username: data.username.trim(),
      email: data.email.trim().toLowerCase(),
      passwordHash,
      role: 'admin',
      pterodactylId: null,
      avatarUrl: null,
    });

    // Grant wildcard server access
    dbGrants.grant(userId, '*');

    return toSafeUser(newAdmin);
  },

  deleteUser(userId: string) {
    dbUsers.delete(userId);
  },

  getUserServerIds(userId: string): string[] {
    const user = dbUsers.getById(userId);
    if (!user) return [];
    if (user.role === 'admin') {
      return ['*'];
    }
    return dbGrants.getUserServers(userId);
  },

  grantServerAccess(userId: string, serverIdentifier: string) {
    dbGrants.grant(userId, serverIdentifier);
  },

  revokeServerAccess(userId: string, serverIdentifier: string) {
    dbGrants.revoke(userId, serverIdentifier);
  },
};
