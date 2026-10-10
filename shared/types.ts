/**
 * RexaCloud Shared Type Definitions
 * Shared between frontend React application and backend Express API
 */

export type UserRole = 'customer' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  pterodactylId?: number;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: string;
}

export type ServerStatus = 'running' | 'offline' | 'starting' | 'stopping';

export interface ServerLimits {
  memory: number; // in MB
  swap: number;
  disk: number; // in MB
  io: number;
  cpu: number; // percentage (e.g. 100%, 300%)
  threads?: string | null;
}

export interface ServerFeatureLimits {
  databases: number;
  allocations: number;
  backups: number;
}

export interface ServerAllocation {
  id: number;
  ip: string;
  alias?: string | null;
  port: number;
  isDefault: boolean;
}

export interface ServerUtilization {
  state: ServerStatus;
  isSuspended: boolean;
  cpuAbsolute: number; // current CPU %
  memoryBytes: number;
  memoryLimitBytes: number;
  diskBytes: number;
  diskLimitBytes: number;
  rxBytes: number;
  txBytes: number;
  uptime: number; // in ms
  playerCount?: number;
  maxPlayers?: number;
}

export interface PterodactylServer {
  id: string;
  uuid: string;
  identifier: string; // 8-char short identifier
  name: string;
  description: string;
  node: string;
  isOwner: boolean;
  isSuspended: boolean;
  gameType: string;
  software: string;
  version: string;
  ip: string;
  port: number;
  limits: ServerLimits;
  featureLimits: ServerFeatureLimits;
  allocations: ServerAllocation[];
  utilization: ServerUtilization;
  createdAt: string;
}

export interface ServerFile {
  name: string;
  path: string;
  mode: string;
  size: number; // in bytes
  isFile: boolean;
  isSymlink: boolean;
  mimetype: string;
  createdAt: string;
  modifiedAt: string;
}

export interface BackupItem {
  uuid: string;
  name: string;
  bytes: number;
  isSuccessful: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface DatabaseItem {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  maxConnections: number;
}

export interface SubuserItem {
  id: string;
  uuid: string;
  username: string;
  email: string;
  permissions: string[];
}

export interface AdminNode {
  id: number;
  name: string;
  description: string;
  locationId: number;
  locationName: string;
  fqdn: string;
  scheme: 'http' | 'https';
  daemonListen: number;
  memory: number; // Total MB
  memoryAllocated: number;
  disk: number; // Total MB
  diskAllocated: number;
  serversCount: number;
  maintenanceMode: boolean;
  status: 'online' | 'offline' | 'maintenance';
  allocations?: {
    id: number;
    ip: string;
    alias?: string | null;
    port: number;
    assigned: boolean;
  }[];
}

export interface NodeReadiness {
  configured: boolean;
  node: {
    id: number;
    name: string;
    fqdn: string;
    scheme: string;
    daemonListen: number;
    memory: number;
    disk: number;
    maintenanceMode: boolean;
  } | null;
  wingsOnline: boolean;
  totalAllocations: number;
  availableAllocations: number;
  allocations: {
    id: number;
    ip: string;
    port: number;
    assigned: boolean;
  }[];
  readinessStatus: 'READY' | 'NO_ALLOCATIONS' | 'MAINTENANCE' | 'OFFLINE' | 'UNCONFIGURED';
  message: string;
}

export interface AdminLocation {
  id: number;
  short: string;
  long: string;
  nodesCount: number;
  serversCount: number;
}

export interface AdminEgg {
  id: number;
  name: string;
  nestId: number;
  nestName: string;
  description: string;
  dockerImage: string;
  startup: string;
}

export interface AdminNest {
  id: number;
  name: string;
  description: string;
  eggs: AdminEgg[];
}

export interface ActivityLog {
  id: string;
  userId?: string;
  username: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
  ip?: string;
}

export interface SystemConnectionStatus {
  configured: boolean;
  pterodactylUrl?: string;
  panelUrl?: string;
  hasClientKey?: boolean;
  hasAppKey?: boolean;
  clientApiConnected: boolean;
  appApiConnected: boolean;
  isDemoMode: boolean;
  latencyMs: number;
  lastChecked?: string;
  errorMessage?: string;
}

export interface CreateServerRequest {
  name: string;
  description?: string;
  userId: number | string;
  nestId: number;
  eggId: number;
  dockerImage?: string;
  startup?: string;
  environment?: Record<string, string>;
  limits: {
    memory: number;
    swap: number;
    disk: number;
    io: number;
    cpu: number;
  };
  featureLimits?: {
    databases: number;
    allocations: number;
    backups: number;
  };
  allocation?: {
    default: number;
  };
  allocationId?: number;
  nodeId?: number;
}
