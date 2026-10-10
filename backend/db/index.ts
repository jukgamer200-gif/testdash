/**
 * RexaCloud Persistent Database Module
 * Uses Node 22 native SQLite (DatabaseSync) for fast, zero-dependency, transactional persistence.
 * Stores user accounts, sessions, server access grants, audit logs, and panel settings.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_PATH = path.join(DB_DIR, 'rexacloud.sqlite');

// Ensure database directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys for high performance and durability
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize schema and migrations
 */
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      pterodactyl_id INTEGER,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_server_grants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_identifier TEXT NOT NULL,
      permissions TEXT DEFAULT '["*"]',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, server_identifier)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip_address TEXT,
      user_agent TEXT,
      expires_at INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'success',
      ip_address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  `);
}

// Auto-run schema initialization
initDatabase();

// ================= Database Accessors =================

export interface DbUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'customer' | 'admin';
  pterodactyl_id: number | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  token: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: number;
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  resource: string;
  details: string;
  status: 'success' | 'warning' | 'error';
  ip_address: string | null;
  created_at: string;
}

export const dbUsers = {
  getById(id: string): DbUser | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as DbUser | undefined;
  },

  getByUsername(username: string): DbUser | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)');
    return stmt.get(username) as DbUser | undefined;
  },

  getByEmail(email: string): DbUser | undefined {
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
    return stmt.get(email) as DbUser | undefined;
  },

  getByUsernameOrEmail(identifier: string): DbUser | undefined {
    const term = identifier.toLowerCase();
    const stmt = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?');
    return stmt.get(term, term) as DbUser | undefined;
  },

  getAll(): DbUser[] {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
    return stmt.all() as unknown as DbUser[];
  },

  count(): number {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get() as { count: number };
    return result?.count || 0;
  },

  create(user: {
    id: string;
    username: string;
    email: string;
    passwordHash: string;
    role: 'customer' | 'admin';
    pterodactylId?: number | null;
    avatarUrl?: string | null;
  }): DbUser {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, pterodactyl_id, avatar_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.username,
      user.email,
      user.passwordHash,
      user.role,
      user.pterodactylId ?? null,
      user.avatarUrl ?? null,
      now,
      now
    );

    return dbUsers.getById(user.id)!;
  },

  delete(id: string) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(id);
  },

  updateRole(id: string, role: 'customer' | 'admin') {
    const stmt = db.prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?');
    stmt.run(role, new Date().toISOString(), id);
  },

  updatePterodactylId(id: string, pterodactylId: number) {
    const stmt = db.prepare('UPDATE users SET pterodactyl_id = ?, updated_at = ? WHERE id = ?');
    stmt.run(pterodactylId, new Date().toISOString(), id);
  },
};

export const dbGrants = {
  getUserServers(userId: string): string[] {
    const stmt = db.prepare('SELECT server_identifier FROM user_server_grants WHERE user_id = ?');
    const rows = stmt.all(userId) as unknown as { server_identifier: string }[];
    return rows.map((r) => r.server_identifier);
  },

  grant(userId: string, serverIdentifier: string, permissions = '["*"]') {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_server_grants (user_id, server_identifier, permissions, created_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(userId, serverIdentifier, permissions, new Date().toISOString());
  },

  revoke(userId: string, serverIdentifier: string) {
    const stmt = db.prepare('DELETE FROM user_server_grants WHERE user_id = ? AND server_identifier = ?');
    stmt.run(userId, serverIdentifier);
  },
};

export const dbSessions = {
  create(token: string, userId: string, expiresAt: number, ipAddress?: string, userAgent?: string) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO sessions (token, user_id, ip_address, user_agent, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(token, userId, ipAddress ?? null, userAgent ?? null, expiresAt, new Date().toISOString());
  },

  get(token: string): (DbSession & { user: DbUser }) | undefined {
    const now = Date.now();
    const stmt = db.prepare(`
      SELECT s.*, u.id as u_id, u.username, u.email, u.password_hash, u.role, u.pterodactyl_id, u.avatar_url, u.created_at as u_created_at, u.updated_at as u_updated_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `);
    const row = stmt.get(token, now) as any;
    if (!row) return undefined;

    return {
      token: row.token,
      user_id: row.user_id,
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      expires_at: row.expires_at,
      created_at: row.created_at,
      user: {
        id: row.u_id,
        username: row.username,
        email: row.email,
        password_hash: row.password_hash,
        role: row.role,
        pterodactyl_id: row.pterodactyl_id,
        avatar_url: row.avatar_url,
        created_at: row.u_created_at,
        updated_at: row.u_updated_at,
      },
    };
  },

  delete(token: string) {
    const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
    stmt.run(token);
  },

  cleanExpired() {
    const stmt = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');
    stmt.run(Date.now());
  },
};

export const dbAudit = {
  log(entry: {
    id: string;
    userId?: string | null;
    username: string;
    action: string;
    resource: string;
    details: string;
    status?: 'success' | 'warning' | 'error';
    ipAddress?: string | null;
  }) {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, resource, details, status, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.userId ?? null,
      entry.username,
      entry.action,
      entry.resource,
      entry.details,
      entry.status ?? 'success',
      entry.ipAddress ?? null,
      new Date().toISOString()
    );
  },

  getRecent(limit = 20, username?: string): DbAuditLog[] {
    if (username) {
      const stmt = db.prepare(`
        SELECT * FROM audit_logs WHERE username = ? ORDER BY created_at DESC LIMIT ?
      `);
      return stmt.all(username, limit) as unknown as DbAuditLog[];
    }
    const stmt = db.prepare(`
      SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?
    `);
    return stmt.all(limit) as unknown as DbAuditLog[];
  },
};

export const dbSettings = {
  get(key: string): string | null {
    const stmt = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?');
    const row = stmt.get(key) as { setting_value: string } | undefined;
    return row ? row.setting_value : null;
  },

  set(key: string, value: string) {
    const stmt = db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = excluded.updated_at
    `);
    stmt.run(key, value, new Date().toISOString());
  },

  getAll(): Record<string, string> {
    const stmt = db.prepare('SELECT setting_key, setting_value FROM system_settings');
    const rows = stmt.all() as unknown as { setting_key: string; setting_value: string }[];
    const res: Record<string, string> = {};
    for (const r of rows) {
      res[r.setting_key] = r.setting_value;
    }
    return res;
  },
};
