/**
 * RexaCloud Audit Logging Service
 * Records real administrative and customer server actions persistently into SQLite.
 * No hardcoded fake logs.
 */

import crypto from 'crypto';
import { ActivityLog } from '@/shared/types';
import { dbAudit } from '../db/index.js';

export const auditService = {
  log(entry: {
    userId?: string;
    username: string;
    action: string;
    resource: string;
    details: string;
    status?: 'success' | 'warning' | 'error';
    ip?: string;
  }): ActivityLog {
    const logId = `log-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const timestamp = new Date().toISOString();

    dbAudit.log({
      id: logId,
      userId: entry.userId || null,
      username: entry.username,
      action: entry.action,
      resource: entry.resource,
      details: entry.details,
      status: entry.status || 'success',
      ipAddress: entry.ip || null,
    });

    return {
      id: logId,
      userId: entry.userId,
      username: entry.username,
      action: entry.action,
      resource: entry.resource,
      details: entry.details,
      timestamp,
      status: entry.status || 'success',
      ip: entry.ip,
    };
  },

  getLogs(limit = 15, username?: string): ActivityLog[] {
    const rawLogs = dbAudit.getRecent(limit, username);
    return rawLogs.map((l) => ({
      id: l.id,
      userId: l.user_id || undefined,
      username: l.username,
      action: l.action,
      resource: l.resource,
      details: l.details,
      timestamp: l.created_at,
      status: l.status,
      ip: l.ip_address || undefined,
    }));
  },
};
