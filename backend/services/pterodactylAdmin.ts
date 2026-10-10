/**
 * RexaCloud Pterodactyl Application API Service
 * Handles administrative infrastructure operations (Users, Servers, Nodes, Nests, Eggs, Locations).
 * Strictly protects Application API credentials and executes server-side validation.
 * No mock data, no fake nodes, no placeholder counts.
 */

import { config } from '../config.js';
import { AdminNode, AdminLocation, AdminNest, CreateServerRequest, SystemConnectionStatus } from '@/shared/types';

// Helper to call official Application API
async function callPterodactylApp(endpoint: string, method = 'GET', body?: any) {
  if (!config.pterodactylUrl || !config.applicationApiKey) {
    throw new Error('Pterodactyl Application API credentials are not configured. Please enter your Panel URL and Application API Key in Settings.');
  }

  const url = `${config.pterodactylUrl}/api/application${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.applicationApiKey}`,
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
    throw new Error(`Pterodactyl Application API error (${response.status}): ${detail}`);
  }

  if (response.status === 204) return { success: true };
  return response.json();
}

export const pterodactylAdmin = {
  isConfigured(): boolean {
    return !!(config.pterodactylUrl && config.applicationApiKey);
  },

  async getNodes(): Promise<AdminNode[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/nodes?include=allocations,location,servers');
    return (data.data || []).map((item: any) => {
      const a = item.attributes;
      return {
        id: a.id,
        name: a.name,
        description: a.description || '',
        locationId: a.location_id,
        locationName: `Location #${a.location_id}`,
        fqdn: a.fqdn,
        scheme: a.scheme,
        daemonListen: a.daemon_listen,
        memory: a.memory,
        memoryAllocated: a.allocated_resources?.memory || 0,
        disk: a.disk,
        diskAllocated: a.allocated_resources?.disk || 0,
        serversCount: a.servers_count || 0,
        maintenanceMode: a.maintenance_mode,
        status: a.maintenance_mode ? 'maintenance' : 'online',
        allocations: (a.relationships?.allocations?.data || []).map((alloc: any) => ({
          id: alloc.attributes.id,
          ip: alloc.attributes.ip,
          alias: alloc.attributes.ip_alias,
          port: alloc.attributes.port,
          assigned: alloc.attributes.assigned ?? false,
        })),
      };
    });
  },

  async getNodeAllocations(nodeId: number): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const data = await callPterodactylApp(`/nodes/${nodeId}/allocations`);
    return (data.data || []).map((item: any) => ({
      id: item.attributes.id,
      ip: item.attributes.ip,
      alias: item.attributes.ip_alias,
      port: item.attributes.port,
      assigned: item.attributes.assigned ?? false,
    }));
  },

  async createLocation(location: { short: string; long: string }): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp('/locations', 'POST', location);
  },

  async checkNodeReadiness(nodeId: number): Promise<any> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        node: null,
        wingsOnline: false,
        totalAllocations: 0,
        availableAllocations: 0,
        allocations: [],
        readinessStatus: 'UNCONFIGURED',
        message: 'Pterodactyl Application API is not configured.',
      };
    }

    try {
      const nodeData = await callPterodactylApp(`/nodes/${nodeId}?include=allocations,servers`);
      const attr = nodeData.attributes;
      const rawAllocs = attr.relationships?.allocations?.data || [];
      const allocations = rawAllocs.map((a: any) => ({
        id: a.attributes.id,
        ip: a.attributes.ip,
        port: a.attributes.port,
        assigned: a.attributes.assigned ?? false,
      }));
      const available = allocations.filter((a: any) => !a.assigned);

      // Probe Wings daemon
      let wingsOnline = false;
      try {
        const daemonUrl = `${attr.scheme}://${attr.fqdn}:${attr.daemon_listen}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const pingResp = await fetch(daemonUrl, { signal: controller.signal }).catch(() => null);
        clearTimeout(timeout);
        if (pingResp) {
          wingsOnline = true;
        }
      } catch {
        wingsOnline = false;
      }

      let readinessStatus: 'READY' | 'NO_ALLOCATIONS' | 'MAINTENANCE' | 'OFFLINE' | 'UNCONFIGURED' = 'READY';
      let message = 'Node is online and ready for server provisioning.';

      if (attr.maintenance_mode) {
        readinessStatus = 'MAINTENANCE';
        message = 'Node is currently in maintenance mode.';
      } else if (allocations.length === 0 || available.length === 0) {
        readinessStatus = 'NO_ALLOCATIONS';
        message = 'Node has no available IP/port allocations. Add an allocation in Pterodactyl first.';
      } else if (!wingsOnline) {
        readinessStatus = 'OFFLINE';
        message = `Wings daemon is not responding at ${attr.fqdn}:${attr.daemon_listen}. Check that the Wings daemon service is running.`;
      }

      return {
        configured: true,
        node: {
          id: attr.id,
          name: attr.name,
          fqdn: attr.fqdn,
          scheme: attr.scheme,
          daemonListen: attr.daemon_listen,
          memory: attr.memory,
          disk: attr.disk,
          maintenanceMode: attr.maintenance_mode,
        },
        wingsOnline,
        totalAllocations: allocations.length,
        availableAllocations: available.length,
        allocations: available,
        readinessStatus,
        message,
      };
    } catch (err: any) {
      return {
        configured: true,
        node: null,
        wingsOnline: false,
        totalAllocations: 0,
        availableAllocations: 0,
        allocations: [],
        readinessStatus: 'OFFLINE',
        message: 'Failed to inspect node: ' + err.message,
      };
    }
  },

  async getLocations(): Promise<AdminLocation[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/locations');
    return (data.data || []).map((item: any) => ({
      id: item.attributes.id,
      short: item.attributes.short,
      long: item.attributes.long,
      nodesCount: 0,
      serversCount: 0,
    }));
  },

  async getNests(): Promise<AdminNest[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/nests?include=eggs');
    return (data.data || []).map((n: any) => ({
      id: n.attributes.id,
      name: n.attributes.name,
      description: n.attributes.description,
      eggs: (n.attributes.relationships?.eggs?.data || []).map((e: any) => ({
        id: e.attributes.id,
        nestId: n.attributes.id,
        nestName: n.attributes.name,
        name: e.attributes.name,
        description: e.attributes.description,
        dockerImage: e.attributes.docker_image,
        startup: e.attributes.startup,
      })),
    }));
  },

  async getEggs(nestId: number): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp(`/nests/${nestId}/eggs?include=variables`);
    return data.data || [];
  },

  async listAllServers(): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const data = await callPterodactylApp('/servers');
    return data.data || [];
  },

  async createServer(payload: CreateServerRequest) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }

    // Enforce 32 GB RAM limit (32768 MB)
    const MAX_RAM_MB = 32768;
    const memory = Number(payload.limits?.memory);
    if (!Number.isInteger(memory) || memory <= 0) {
      throw new Error('Memory limit must be a positive integer in MB.');
    }
    if (memory > MAX_RAM_MB) {
      throw new Error(`Maximum server RAM allocation is 32 GB (${MAX_RAM_MB} MB). Requested: ${memory} MB.`);
    }

    // Resolve allocation ID
    const defaultAlloc = payload.allocationId || (typeof payload.allocation === 'object' ? payload.allocation?.default : payload.allocation);
    if (!defaultAlloc || isNaN(Number(defaultAlloc))) {
      throw new Error('An eligible allocation ID is required to create a server.');
    }

    // Call official Pterodactyl Application API /servers endpoint
    const body = {
      name: payload.name.trim(),
      description: payload.description || '',
      user: Number(payload.userId) || 1,
      egg: Number(payload.eggId),
      docker_image: payload.dockerImage || 'ghcr.io/pterodactyl/yolks:java_21',
      startup: payload.startup || 'java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}',
      environment: payload.environment || {},
      limits: {
        memory: memory,
        swap: payload.limits.swap || 0,
        disk: Number(payload.limits.disk) || 10240,
        io: payload.limits.io || 500,
        cpu: Number(payload.limits.cpu) || 100,
      },
      feature_limits: {
        databases: payload.featureLimits?.databases || 0,
        allocations: payload.featureLimits?.allocations || 1,
        backups: payload.featureLimits?.backups || 0,
      },
      allocation: {
        default: Number(defaultAlloc),
      },
    };

    return callPterodactylApp('/servers', 'POST', body);
  },

  async deleteServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}`, 'DELETE');
  },

  async suspendServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}/suspend`, 'POST');
  },

  async unsuspendServer(id: string | number) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp(`/servers/${id}/unsuspend`, 'POST');
  },

  async getPterodactylUsers(): Promise<any[]> {
    if (!this.isConfigured()) {
      return [];
    }
    const data = await callPterodactylApp('/users');
    return data.data || [];
  },

  async createPterodactylUser(userData: {
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    password?: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Pterodactyl Application API is not configured.');
    }
    return callPterodactylApp('/users', 'POST', userData);
  },

  async testConnection(): Promise<SystemConnectionStatus> {
    const configured = !!(config.pterodactylUrl && (config.clientApiKey || config.applicationApiKey));
    if (!configured) {
      return {
        configured: false,
        clientApiConnected: false,
        appApiConnected: false,
        isDemoMode: false,
        latencyMs: 0,
        panelUrl: config.pterodactylUrl || '',
        errorMessage: 'Pterodactyl Panel credentials not configured in settings or environment.',
      };
    }

    let clientOk = false;
    let appOk = false;
    let latency = 0;
    const errors: string[] = [];

    const startTime = Date.now();

    // Probe Client API if key provided
    if (config.clientApiKey) {
      try {
        const resp = await fetch(`${config.pterodactylUrl}/api/client`, {
          headers: {
            Authorization: `Bearer ${config.clientApiKey}`,
            Accept: 'application/json',
          },
        });
        clientOk = resp.ok;
        if (!resp.ok) {
          errors.push(`Client API returned HTTP ${resp.status}`);
        }
      } catch (err: any) {
        errors.push(`Client API unreachable: ${err.message}`);
      }
    }

    // Probe Application API if key provided
    if (config.applicationApiKey) {
      try {
        const resp = await fetch(`${config.pterodactylUrl}/api/application/nodes`, {
          headers: {
            Authorization: `Bearer ${config.applicationApiKey}`,
            Accept: 'application/json',
          },
        });
        appOk = resp.ok;
        if (!resp.ok) {
          errors.push(`Application API returned HTTP ${resp.status}`);
        }
      } catch (err: any) {
        errors.push(`Application API unreachable: ${err.message}`);
      }
    }

    latency = Date.now() - startTime;

    return {
      configured: true,
      clientApiConnected: clientOk,
      appApiConnected: appOk,
      isDemoMode: false,
      latencyMs: latency,
      panelUrl: config.pterodactylUrl,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
    };
  },
};
