/**
 * RexaCloud Client API Controller
 * Customer server management operations (power, console, files, backups, databases).
 * Connects directly to live Pterodactyl Panel API.
 * No mock data, no fake power buttons, genuine error responses.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { pterodactylClient } from '../services/pterodactylClient.js';
import { authService } from '../services/authService.js';
import { auditService } from '../services/auditService.js';

export const clientController = {
  async getDashboardSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const isConfigured = pterodactylClient.isConfigured();
      const totalUsers = authService.getUserCount();
      const recentActivity = auditService.getLogs(6, req.user!.role === 'admin' ? undefined : req.user!.username);

      if (!isConfigured) {
        return res.json({
          configured: false,
          summary: {
            totalServers: 0,
            runningServers: 0,
            stoppedServers: 0,
            totalBackups: 0,
            totalUsers,
            resources: {
              cpuPercent: 0,
              memoryUsedGB: 0,
              memoryTotalGB: 0,
              memoryPercent: 0,
              diskUsedGB: 0,
              diskTotalGB: 0,
              diskPercent: 0,
            },
          },
          servers: [],
          recentActivity,
          message: 'Pterodactyl Panel connection is not configured.',
        });
      }

      const allowedServerIds = authService.getUserServerIds(req.user!.id);
      const servers = await pterodactylClient.listServers(allowedServerIds);

      const totalServers = servers.length;
      const runningServers = servers.filter((s) => s.utilization.state === 'running').length;
      const stoppedServers = servers.filter((s) => s.utilization.state === 'offline').length;

      let totalMemBytes = 0;
      let totalMemLimitBytes = 0;
      let totalDiskBytes = 0;
      let totalDiskLimitBytes = 0;
      let totalCpuPct = 0;

      for (const s of servers) {
        totalMemBytes += s.utilization.memoryBytes || 0;
        totalMemLimitBytes += s.utilization.memoryLimitBytes || s.limits.memory * 1024 * 1024 || 0;
        totalDiskBytes += s.utilization.diskBytes || 0;
        totalDiskLimitBytes += s.utilization.diskLimitBytes || s.limits.disk * 1024 * 1024 || 0;
        totalCpuPct += s.utilization.cpuAbsolute || 0;
      }

      return res.json({
        configured: true,
        summary: {
          totalServers,
          runningServers,
          stoppedServers,
          totalBackups: 0,
          totalUsers,
          resources: {
            cpuPercent: totalServers ? Math.round(totalCpuPct / totalServers) : 0,
            memoryUsedGB: +(totalMemBytes / (1024 * 1024 * 1024)).toFixed(1),
            memoryTotalGB: +(totalMemLimitBytes / (1024 * 1024 * 1024)).toFixed(0),
            memoryPercent: totalMemLimitBytes ? Math.round((totalMemBytes / totalMemLimitBytes) * 100) : 0,
            diskUsedGB: +(totalDiskBytes / (1024 * 1024 * 1024)).toFixed(0),
            diskTotalGB: +(totalDiskLimitBytes / (1024 * 1024 * 1024)).toFixed(0),
            diskPercent: totalDiskLimitBytes ? Math.round((totalDiskBytes / totalDiskLimitBytes) * 100) : 0,
          },
        },
        servers,
        recentActivity,
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve dashboard summary', message: err.message });
    }
  },

  async listServers(req: AuthenticatedRequest, res: Response) {
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.json({ configured: false, servers: [] });
      }
      const allowedServerIds = authService.getUserServerIds(req.user!.id);
      const servers = await pterodactylClient.listServers(allowedServerIds);
      return res.json({ configured: true, servers });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to list servers', message: err.message });
    }
  },

  async getServer(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured', configured: false });
      }
      const server = await pterodactylClient.getServer(identifier);
      return res.json({ server });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to get server details', message: err.message });
    }
  },

  async getServerResources(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured', configured: false });
      }
      const resources = await pterodactylClient.getServerUtilization(identifier);
      return res.json({ resources });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to get server resources', message: err.message });
    }
  },

  async sendPowerAction(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { signal } = req.body;

    if (!['start', 'stop', 'restart', 'kill'].includes(signal)) {
      return res.status(400).json({ error: 'Invalid power signal. Allowed: start, stop, restart, kill' });
    }

    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }

      const result = await pterodactylClient.sendPowerAction(identifier, signal);

      auditService.log({
        userId: req.user!.id,
        username: req.user!.username,
        action: `SERVER_POWER_${signal.toUpperCase()}`,
        resource: identifier,
        details: `Dispatched power signal "${signal}" to server ${identifier}`,
        status: 'success',
      });

      return res.json({ success: true, signal, result });
    } catch (err: any) {
      return res.status(500).json({ error: `Power action failed: ${err.message}` });
    }
  },

  async sendCommand(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command string is required' });
    }

    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }

      const result = await pterodactylClient.sendCommand(identifier, command);

      auditService.log({
        userId: req.user!.id,
        username: req.user!.username,
        action: 'SERVER_COMMAND',
        resource: identifier,
        details: `Sent console command: ${command.substring(0, 50)}`,
        status: 'success',
      });

      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ error: `Command dispatch failed: ${err.message}` });
    }
  },

  async getWebsocketCredentials(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const data = await pterodactylClient.getWebsocketCredentials(identifier);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to get websocket credentials: ${err.message}` });
    }
  },

  async listFiles(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const directory = (req.query.directory as string) || '/';
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.json({ files: [] });
      }
      const files = await pterodactylClient.listFiles(identifier, directory);
      return res.json({ files });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to list files: ${err.message}` });
    }
  },

  async getFileContents(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const file = req.query.file as string;
    if (!file) {
      return res.status(400).json({ error: 'File path required' });
    }
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const content = await pterodactylClient.getFileContents(identifier, file);
      return res.type('text/plain').send(content);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to read file: ${err.message}` });
    }
  },

  async writeFile(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { file, content } = req.body;
    if (!file || content === undefined) {
      return res.status(400).json({ error: 'File path and content are required' });
    }
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      await pterodactylClient.writeFile(identifier, file, content);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to save file: ${err.message}` });
    }
  },

  async createFolder(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { root = '/', name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const result = await pterodactylClient.createFolder(identifier, root, name);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to create folder: ${err.message}` });
    }
  },

  async deleteFiles(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { root = '/', files } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Files array is required' });
    }
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const result = await pterodactylClient.deleteFiles(identifier, root, files);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to delete files: ${err.message}` });
    }
  },

  async renameFile(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { root = '/', from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to names are required' });
    }
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const result = await pterodactylClient.renameFile(identifier, root, from, to);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to rename file: ${err.message}` });
    }
  },

  async listBackups(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.json({ backups: [] });
      }
      const backups = await pterodactylClient.listBackups(identifier);
      return res.json({ backups });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to list backups: ${err.message}` });
    }
  },

  async createBackup(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    const { name = `Backup_${new Date().toISOString()}` } = req.body;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      const backup = await pterodactylClient.createBackup(identifier, name);
      return res.json({ backup });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to create backup: ${err.message}` });
    }
  },

  async deleteBackup(req: AuthenticatedRequest, res: Response) {
    const { identifier, backupUuid } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.status(503).json({ error: 'Pterodactyl Panel not configured' });
      }
      await pterodactylClient.deleteBackup(identifier, backupUuid);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to delete backup: ${err.message}` });
    }
  },

  async listDatabases(req: AuthenticatedRequest, res: Response) {
    const { identifier } = req.params;
    try {
      if (!pterodactylClient.isConfigured()) {
        return res.json({ databases: [] });
      }
      const databases = await pterodactylClient.listDatabases(identifier);
      return res.json({ databases });
    } catch (err: any) {
      return res.status(500).json({ error: `Failed to list databases: ${err.message}` });
    }
  },
};
