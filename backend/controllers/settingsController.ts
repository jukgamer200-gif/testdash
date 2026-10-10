/**
 * RexaCloud System Settings & Connection Controller
 * Provides diagnostics, connection testing, and secure credential updating.
 * Never leaks existing API secret keys to client responses.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { pterodactylAdmin } from '../services/pterodactylAdmin.js';
import { updateDynamicConfig } from '../config.js';
import { auditService } from '../services/auditService.js';

export const settingsController = {
  async getStatus(req: Request, res: Response) {
    try {
      const status = await pterodactylAdmin.testConnection();
      return res.json({ status });
    } catch (err: any) {
      return res.status(500).json({ error: 'Connection check failed', message: err.message });
    }
  },

  async testConnection(req: AuthenticatedRequest, res: Response) {
    try {
      const status = await pterodactylAdmin.testConnection();
      return res.json({ status });
    } catch (err: any) {
      return res.status(500).json({ error: 'Test failed', message: err.message });
    }
  },

  async updateSettings(req: AuthenticatedRequest, res: Response) {
    const { pterodactylUrl, clientApiKey, applicationApiKey } = req.body;

    updateDynamicConfig({
      pterodactylUrl,
      clientApiKey,
      applicationApiKey,
    });

    auditService.log({
      userId: req.user!.id,
      username: req.user!.username,
      action: 'SETTINGS_UPDATE',
      resource: 'Pterodactyl Configuration',
      details: `Updated panel integration URL to: ${pterodactylUrl || 'unchanged'}`,
      status: 'warning',
    });

    const status = await pterodactylAdmin.testConnection();
    return res.json({
      message: 'Integration settings updated successfully',
      status,
    });
  },
};
