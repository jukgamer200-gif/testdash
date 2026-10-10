/**
 * RexaCloud Frontend API Service
 * Centralized HTTP client communicating with backend Express API endpoints.
 * Injects genuine Bearer authentication tokens and handles error states.
 * No mock data, no pretend responses.
 */

import {
  User,
  AuthSession,
  PterodactylServer,
  ServerUtilization,
  ServerFile,
  BackupItem,
  DatabaseItem,
  AdminNode,
  AdminLocation,
  AdminNest,
  ActivityLog,
  SystemConnectionStatus,
  CreateServerRequest,
} from '@/shared/types';

const API_BASE = '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem('rexacloud_token');
    } catch {
      this.token = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('rexacloud_token', token);
      } else {
        localStorage.removeItem('rexacloud_token');
      }
    } catch {}
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.body && !(options.body instanceof FormData) && typeof options.body !== 'string') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.setToken(null);
    }

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.message || errorJson.error || errorMessage;
      } catch {
        // use default status text
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // ================= Auth =================
  async login(username: string, password: string): Promise<{ session: AuthSession }> {
    const res = await this.request<{ session: AuthSession }>('/auth/login', {
      method: 'POST',
      body: { username, password } as any,
    });
    this.setToken(res.session.token);
    return res;
  }

  async signup(username: string, email: string, password: string): Promise<{ session: AuthSession }> {
    const res = await this.request<{ session: AuthSession }>('/auth/signup', {
      method: 'POST',
      body: { username, email, password } as any,
    });
    this.setToken(res.session.token);
    return res;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // ================= Customer Client API =================
  async getDashboardSummary(): Promise<{
    configured: boolean;
    summary: {
      totalServers: number;
      runningServers: number;
      stoppedServers: number;
      totalBackups: number;
      totalUsers: number;
      resources: {
        cpuPercent: number;
        memoryUsedGB: number;
        memoryTotalGB: number;
        memoryPercent: number;
        diskUsedGB: number;
        diskTotalGB: number;
        diskPercent: number;
      };
    };
    servers: PterodactylServer[];
    recentActivity: ActivityLog[];
    message?: string;
  }> {
    return this.request('/client/dashboard');
  }

  async listServers(): Promise<{ configured: boolean; servers: PterodactylServer[] }> {
    return this.request('/client/servers');
  }

  async getServer(identifier: string): Promise<{ server: PterodactylServer }> {
    return this.request(`/client/servers/${identifier}`);
  }

  async getServerResources(identifier: string): Promise<{ resources: ServerUtilization }> {
    return this.request(`/client/servers/${identifier}/resources`);
  }

  async sendPowerAction(identifier: string, signal: 'start' | 'stop' | 'restart' | 'kill'): Promise<any> {
    return this.request(`/client/servers/${identifier}/power`, {
      method: 'POST',
      body: { signal } as any,
    });
  }

  async sendCommand(identifier: string, command: string): Promise<{ success: boolean; result?: any }> {
    return this.request(`/client/servers/${identifier}/command`, {
      method: 'POST',
      body: { command } as any,
    });
  }

  async getWebsocketCredentials(identifier: string): Promise<{ token: string; socket: string }> {
    return this.request(`/client/servers/${identifier}/websocket`);
  }

  async listFiles(identifier: string, directory = '/'): Promise<{ files: ServerFile[] }> {
    return this.request(`/client/servers/${identifier}/files/list?directory=${encodeURIComponent(directory)}`);
  }

  async getFileContents(identifier: string, filePath: string): Promise<string> {
    const headers: Record<string, string> = {
      Accept: 'text/plain',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const response = await fetch(`${API_BASE}/client/servers/${identifier}/files/contents?file=${encodeURIComponent(filePath)}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }
    return response.text();
  }

  async writeFile(identifier: string, file: string, content: string): Promise<any> {
    return this.request(`/client/servers/${identifier}/files/write`, {
      method: 'POST',
      body: { file, content } as any,
    });
  }

  async createFolder(identifier: string, root: string, name: string): Promise<any> {
    return this.request(`/client/servers/${identifier}/files/create-folder`, {
      method: 'POST',
      body: { root, name } as any,
    });
  }

  async deleteFiles(identifier: string, root: string, files: string[]): Promise<any> {
    return this.request(`/client/servers/${identifier}/files/delete`, {
      method: 'POST',
      body: { root, files } as any,
    });
  }

  async renameFile(identifier: string, root: string, from: string, to: string): Promise<any> {
    return this.request(`/client/servers/${identifier}/files/rename`, {
      method: 'POST',
      body: { root, from, to } as any,
    });
  }

  async listBackups(identifier: string): Promise<{ backups: BackupItem[] }> {
    return this.request(`/client/servers/${identifier}/backups`);
  }

  async createBackup(identifier: string, name: string): Promise<{ backup: BackupItem }> {
    return this.request(`/client/servers/${identifier}/backups`, {
      method: 'POST',
      body: { name } as any,
    });
  }

  async deleteBackup(identifier: string, backupUuid: string): Promise<any> {
    return this.request(`/client/servers/${identifier}/backups/${backupUuid}`, {
      method: 'DELETE',
    });
  }

  async listDatabases(identifier: string): Promise<{ databases: DatabaseItem[] }> {
    return this.request(`/client/servers/${identifier}/databases`);
  }

  // ================= Administrator Application API =================
  async getAdminOverview(): Promise<{
    configured: boolean;
    stats: {
      users: { total: number; diff: string };
      servers: { total: number; diff: string; online: number; offline: number };
      nodes: { total: number; online: number; label: string };
      cpu: { usage: number; max: number };
      memory: { usedGB: number; totalGB: number };
    };
    recentServers: any[];
    recentActivity: ActivityLog[];
    nodes: AdminNode[];
    locations: AdminLocation[];
    message?: string;
  }> {
    return this.request('/admin/overview');
  }

  async listNodes(): Promise<{ nodes: AdminNode[]; configured: boolean }> {
    return this.request('/admin/nodes');
  }

  async getNodeAllocations(nodeId: number): Promise<{ allocations: any[] }> {
    return this.request(`/admin/nodes/${nodeId}/allocations`);
  }

  async getNodeReadiness(nodeId: number): Promise<{ readiness: any }> {
    return this.request(`/admin/nodes/${nodeId}/readiness`);
  }

  async listLocations(): Promise<{ locations: AdminLocation[]; configured: boolean }> {
    return this.request('/admin/locations');
  }

  async createLocation(data: { short: string; long: string }): Promise<{ success: boolean; location: AdminLocation }> {
    return this.request('/admin/locations', {
      method: 'POST',
      body: data as any,
    });
  }

  async listNests(): Promise<{ nests: AdminNest[]; configured: boolean }> {
    return this.request('/admin/nests');
  }

  async createServer(data: CreateServerRequest): Promise<any> {
    return this.request('/admin/servers', {
      method: 'POST',
      body: data as any,
    });
  }

  async suspendServer(id: string): Promise<any> {
    return this.request(`/admin/servers/${id}/suspend`, { method: 'POST' });
  }

  async unsuspendServer(id: string): Promise<any> {
    return this.request(`/admin/servers/${id}/unsuspend`, { method: 'POST' });
  }

  async deleteServer(id: string): Promise<any> {
    return this.request(`/admin/servers/${id}`, { method: 'DELETE' });
  }

  async listUsers(): Promise<{ users: User[] }> {
    return this.request('/admin/users');
  }

  async createUser(data: { username: string; email: string; role: 'customer' | 'admin'; password?: string }): Promise<{ user: User }> {
    return this.request('/admin/users', {
      method: 'POST',
      body: data as any,
    });
  }

  async deleteUser(id: string): Promise<any> {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }

  async getActivityLogs(limit = 50, user?: string): Promise<{ logs: ActivityLog[] }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (user) params.append('user', user);
    return this.request(`/admin/logs?${params.toString()}`);
  }

  // ================= System Settings & Diagnostics =================
  async getSystemStatus(): Promise<{ status: SystemConnectionStatus }> {
    return this.request('/system/status');
  }

  async testConnection(): Promise<{ status: SystemConnectionStatus }> {
    return this.request('/system/test', { method: 'POST' });
  }

  async updateSystemSettings(data: {
    pterodactylUrl?: string;
    clientApiKey?: string;
    applicationApiKey?: string;
  }): Promise<{ message: string; status: SystemConnectionStatus }> {
    return this.request('/system/settings', {
      method: 'POST',
      body: data as any,
    });
  }
}

export const api = new ApiService();
