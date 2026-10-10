/**
 * RexaCloud API Route Definitions
 * Maps all customer, administrator, authentication, and system endpoints.
 */

import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { clientController } from '../controllers/clientController.js';
import { adminController } from '../controllers/adminController.js';
import { settingsController } from '../controllers/settingsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { verifyServerAccess } from '../middleware/ownership.js';

const api = Router();

// ================= Authentication & Public =================
api.post('/auth/login', authController.login);
api.post('/auth/signup', authController.signup);
api.get('/auth/me', requireAuth, authController.getCurrentUser);
api.post('/auth/logout', requireAuth, authController.logout);
api.get('/system/status', settingsController.getStatus);


// ================= Customer Client API =================
api.get('/client/dashboard', requireAuth, clientController.getDashboardSummary);
api.get('/client/servers', requireAuth, clientController.listServers);
api.get('/client/servers/:identifier', requireAuth, verifyServerAccess, clientController.getServer);
api.get('/client/servers/:identifier/resources', requireAuth, verifyServerAccess, clientController.getServerResources);
api.post('/client/servers/:identifier/power', requireAuth, verifyServerAccess, clientController.sendPowerAction);
api.post('/client/servers/:identifier/command', requireAuth, verifyServerAccess, clientController.sendCommand);
api.get('/client/servers/:identifier/files/list', requireAuth, verifyServerAccess, clientController.listFiles);
api.get('/client/servers/:identifier/files/contents', requireAuth, verifyServerAccess, clientController.getFileContents);
api.post('/client/servers/:identifier/files/write', requireAuth, verifyServerAccess, clientController.writeFile);
api.post('/client/servers/:identifier/files/create-folder', requireAuth, verifyServerAccess, clientController.createFolder);
api.post('/client/servers/:identifier/files/delete', requireAuth, verifyServerAccess, clientController.deleteFiles);
api.post('/client/servers/:identifier/files/rename', requireAuth, verifyServerAccess, clientController.renameFile);
api.get('/client/servers/:identifier/backups', requireAuth, verifyServerAccess, clientController.listBackups);
api.post('/client/servers/:identifier/backups', requireAuth, verifyServerAccess, clientController.createBackup);
api.delete('/client/servers/:identifier/backups/:backupUuid', requireAuth, verifyServerAccess, clientController.deleteBackup);
api.get('/client/servers/:identifier/databases', requireAuth, verifyServerAccess, clientController.listDatabases);
api.get('/client/servers/:identifier/websocket', requireAuth, verifyServerAccess, clientController.getWebsocketCredentials);

// ================= Administrator Application API =================
api.get('/admin/overview', requireAuth, requireAdmin, adminController.getAdminOverview);
api.get('/admin/nodes', requireAuth, requireAdmin, adminController.listNodes);
api.get('/admin/nodes/:id/allocations', requireAuth, requireAdmin, adminController.getNodeAllocations);
api.get('/admin/nodes/:id/readiness', requireAuth, requireAdmin, adminController.getNodeReadiness);
api.get('/admin/locations', requireAuth, requireAdmin, adminController.listLocations);
api.post('/admin/locations', requireAuth, requireAdmin, adminController.createLocation);
api.get('/admin/nests', requireAuth, requireAdmin, adminController.listNests);
api.post('/admin/servers', requireAuth, requireAdmin, adminController.createServer);
api.post('/admin/servers/:id/suspend', requireAuth, requireAdmin, adminController.suspendServer);
api.post('/admin/servers/:id/unsuspend', requireAuth, requireAdmin, adminController.unsuspendServer);
api.delete('/admin/servers/:id', requireAuth, requireAdmin, adminController.deleteServer);
api.get('/admin/users', requireAuth, requireAdmin, authController.listUsers);
api.post('/admin/users', requireAuth, requireAdmin, authController.createUser);
api.delete('/admin/users/:id', requireAuth, requireAdmin, authController.deleteUser);
api.get('/admin/logs', requireAuth, requireAdmin, adminController.getActivityLogs);

// ================= System Configuration & Diagnostic Tests =================
api.post('/system/test', requireAuth, requireAdmin, settingsController.testConnection);
api.post('/system/settings', requireAuth, requireAdmin, settingsController.updateSettings);

export default api;
