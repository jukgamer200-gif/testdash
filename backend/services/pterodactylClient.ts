/**
 * RexaCloud Pterodactyl Client API Service
 * Communicates directly with the official Pterodactyl Client API (https://docs.pterodactyl.io)
 * All credentials remain strictly server-side.
 * No mock data, no fake consoles, no simulated power buttons.
 */

import { config } from '../config.js';
import { PterodactylServer, ServerFile, BackupItem, DatabaseItem, ServerUtilization } from '@/shared/types';

// Helper for calling external Pterodactyl Client API
async function callPterodactylClient(endpoint: string, method = 'GET', body?: any) {
  if (!config.pterodactylUrl || !config.clientApiKey) {
    throw new Error('Pterodactyl Client API credentials are not configured. Please enter your Panel URL and Client API Key in Settings.');
  }

  const url = `${config.pterodactylUrl}/api/client${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.clientApiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.errors && parsed.errors.length > 0) {
        detail = parsed.errors.map((e: any) => e.detail || e.code).join('; ');
      }
    } catch {}
    throw new Error(`Pterodactyl API error (${response.status}): ${detail}`);
  }

  if (response.status === 204) {
    return { success: true };
  }

  return response.json();
}

function mapServerAttributes(attr: any): PterodactylServer {
  const primaryAlloc = attr.relationships?.allocations?.data?.[0]?.attributes;
  return {
    id: String(attr.id),
    uuid: attr.uuid,
    identifier: attr.identifier,
    name: attr.name,
    description: attr.description || '',
    node: attr.node || 'Default Node',
    isOwner: attr.server_owner ?? true,
    isSuspended: attr.is_suspended ?? false,
    gameType: 'Game Server',
    software: 'Custom',
    version: 'Latest',
    ip: primaryAlloc?.ip || '0.0.0.0',
    port: primaryAlloc?.port || 25565,
    limits: {
      memory: attr.limits?.memory || 0,
      swap: attr.limits?.swap || 0,
      disk: attr.limits?.disk || 0,
      io: attr.limits?.io || 500,
      cpu: attr.limits?.cpu || 100,
      threads: attr.limits?.threads || null,
    },
    featureLimits: {
      databases: attr.feature_limits?.databases || 0,
      allocations: attr.feature_limits?.allocations || 0,
      backups: attr.feature_limits?.backups || 0,
    },
    allocations: (attr.relationships?.allocations?.data || []).map((a: any) => ({
      id: a.attributes.id,
      ip: a.attributes.ip,
      port: a.attributes.port,
      alias: a.attributes.ip_alias,
      isDefault: a.attributes.is_default,
    })),
    utilization: {
      state: attr.is_suspended ? 'offline' : 'offline', // will be hydrated via resources call
      isSuspended: attr.is_suspended ?? false,
      cpuAbsolute: 0,
      memoryBytes: 0,
      memoryLimitBytes: (attr.limits?.memory || 0) * 1024 * 1024,
      diskBytes: 0,
      diskLimitBytes: (attr.limits?.disk || 0) * 1024 * 1024,
      rxBytes: 0,
      txBytes: 0,
      uptime: 0,
    },
    createdAt: attr.created_at || new Date().toISOString(),
  };
}

export const pterodactylClient = {
  isConfigured(): boolean {
    return !!(config.pterodactylUrl && config.clientApiKey);
  },

  async listServers(userServerIds?: string[]): Promise<PterodactylServer[]> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }

    const data = await callPterodactylClient('');
    const rawList: any[] = data.data || [];
    let servers: PterodactylServer[] = rawList.map((item: any) => mapServerAttributes(item.attributes));

    // Filter by allowed servers for non-admin accounts
    if (userServerIds && !userServerIds.includes('*')) {
      servers = servers.filter((s) => userServerIds.includes(s.identifier) || userServerIds.includes(s.uuid));
    }

    // Try fetching live resources for up to first 8 servers concurrently for dashboard display
    await Promise.allSettled(
      servers.slice(0, 8).map(async (srv) => {
        try {
          const util = await this.getServerUtilization(srv.identifier);
          srv.utilization = util;
        } catch {}
      })
    );

    return servers;
  },

  async getServer(identifier: string): Promise<PterodactylServer> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }

    const data = await callPterodactylClient(`/servers/${identifier}`);
    const server = mapServerAttributes(data.attributes);

    try {
      server.utilization = await this.getServerUtilization(identifier);
    } catch {}

    return server;
  },

  async getServerUtilization(identifier: string): Promise<ServerUtilization> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }

    const data = await callPterodactylClient(`/servers/${identifier}/resources`);
    const attr = data.attributes;
    return {
      state: attr.current_state || 'offline',
      isSuspended: attr.is_suspended_or_stopped || false,
      cpuAbsolute: Math.round(attr.resources?.cpu_absolute || 0),
      memoryBytes: attr.resources?.memory_bytes || 0,
      memoryLimitBytes: attr.resources?.memory_limit_bytes || 0,
      diskBytes: attr.resources?.disk_bytes || 0,
      diskLimitBytes: attr.resources?.disk_limit_bytes || 0,
      rxBytes: attr.resources?.network_rx_bytes || 0,
      txBytes: attr.resources?.network_tx_bytes || 0,
      uptime: attr.resources?.uptime || 0,
    };
  },

  async sendPowerAction(identifier: string, signal: 'start' | 'stop' | 'restart' | 'kill') {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/power`, 'POST', { signal });
  },

  async sendCommand(identifier: string, command: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/command`, 'POST', { command });
  },

  async getWebsocketCredentials(identifier: string): Promise<{ token: string; socket: string }> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const data = await callPterodactylClient(`/servers/${identifier}/websocket`);
    return data.data;
  },

  async listFiles(identifier: string, directory = '/'): Promise<ServerFile[]> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const encoded = encodeURIComponent(directory);
    const data = await callPterodactylClient(`/servers/${identifier}/files/list?directory=${encoded}`);
    return (data.data || []).map((item: any) => {
      const attr = item.attributes;
      return {
        name: attr.name,
        path: `${directory}/${attr.name}`.replace(/\/+/g, '/'),
        mode: attr.mode,
        size: attr.size,
        isFile: attr.is_file,
        isSymlink: attr.is_symlink,
        mimetype: attr.mimetype,
        createdAt: attr.created_at,
        modifiedAt: attr.modified_at,
      };
    });
  },

  async getFileContents(identifier: string, filePath: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const encoded = encodeURIComponent(filePath);
    const url = `${config.pterodactylUrl}/api/client/servers/${identifier}/files/contents?file=${encoded}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.clientApiKey}`,
        Accept: 'text/plain',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status} ${response.statusText}`);
    }
    return response.text();
  },

  async writeFile(identifier: string, filePath: string, content: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const encoded = encodeURIComponent(filePath);
    const url = `${config.pterodactylUrl}/api/client/servers/${identifier}/files/write?file=${encoded}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.clientApiKey}`,
        'Content-Type': 'text/plain',
      },
      body: content,
    });
    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.status} ${response.statusText}`);
    }
    return { success: true };
  },

  async createFolder(identifier: string, root: string, name: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/files/create-folder`, 'POST', { root, name });
  },

  async deleteFiles(identifier: string, root: string, files: string[]) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/files/delete`, 'POST', { root, files });
  },

  async renameFile(identifier: string, root: string, from: string, to: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/files/rename`, 'PUT', {
      root,
      files: [{ from, to }],
    });
  },

  async listBackups(identifier: string): Promise<BackupItem[]> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const data = await callPterodactylClient(`/servers/${identifier}/backups`);
    return (data.data || []).map((b: any) => ({
      uuid: b.attributes.uuid,
      name: b.attributes.name,
      bytes: b.attributes.bytes,
      isSuccessful: b.attributes.is_successful,
      createdAt: b.attributes.created_at,
      completedAt: b.attributes.completed_at,
    }));
  },

  async createBackup(identifier: string, name: string): Promise<BackupItem> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const data = await callPterodactylClient(`/servers/${identifier}/backups`, 'POST', { name });
    const attr = data.attributes;
    return {
      uuid: attr.uuid,
      name: attr.name,
      bytes: attr.bytes || 0,
      isSuccessful: attr.is_successful,
      createdAt: attr.created_at,
      completedAt: attr.completed_at,
    };
  },

  async deleteBackup(identifier: string, backupUuid: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/backups/${backupUuid}`, 'DELETE');
  },

  async restoreBackup(identifier: string, backupUuid: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/backups/${backupUuid}/restore`, 'POST');
  },

  async listDatabases(identifier: string): Promise<DatabaseItem[]> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    const data = await callPterodactylClient(`/servers/${identifier}/databases`);
    return (data.data || []).map((d: any) => ({
      id: String(d.attributes.id),
      name: d.attributes.name,
      host: d.attributes.host?.address || '127.0.0.1',
      port: d.attributes.host?.port || 3306,
      username: d.attributes.username,
      maxConnections: d.attributes.max_connections || 10,
    }));
  },

  async createDatabase(identifier: string, databaseName: string, remote = '%') {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/databases`, 'POST', {
      database: databaseName,
      remote,
    });
  },

  async deleteDatabase(identifier: string, databaseId: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/databases/${databaseId}`, 'DELETE');
  },

  async rotateDatabasePassword(identifier: string, databaseId: string) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Client API is not configured.');
    }
    return callPterodactylClient(`/servers/${identifier}/databases/${databaseId}/rotate-password`, 'POST');
  },
};
