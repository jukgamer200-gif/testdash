/**
 * RexaCloud Backend Configuration
 * Reads environment variables and database system settings.
 * Never exposes API keys or secrets to client code.
 */

import dotenv from 'dotenv';
import { dbSettings } from './db/index.js';

dotenv.config();

export interface ServerConfig {
  port: number;
  pterodactylUrl: string;
  clientApiKey: string;
  applicationApiKey: string;
  jwtSecret: string;
  nodeEnv: string;
  isPterodactylConfigured: boolean;
}

export const config = {
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  },

  get pterodactylUrl(): string {
    const dbVal = dbSettings.get('PTERODACTYL_PANEL_URL');
    const raw = dbVal || process.env.PTERODACTYL_PANEL_URL || '';
    return raw.trim().replace(/\/+$/, '');
  },

  get clientApiKey(): string {
    const dbVal = dbSettings.get('PTERODACTYL_CLIENT_API_KEY');
    return (dbVal || process.env.PTERODACTYL_CLIENT_API_KEY || '').trim();
  },

  get applicationApiKey(): string {
    const dbVal = dbSettings.get('PTERODACTYL_APPLICATION_API_KEY');
    return (dbVal || process.env.PTERODACTYL_APPLICATION_API_KEY || '').trim();
  },

  get jwtSecret(): string {
    const dbVal = dbSettings.get('JWT_SECRET');
    return (dbVal || process.env.JWT_SECRET || 'rexacloud-production-secret-auth-key').trim();
  },

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'production';
  },

  get isPterodactylConfigured(): boolean {
    return !!(this.pterodactylUrl && (this.clientApiKey || this.applicationApiKey));
  },

  get isDemoMode(): boolean {
    return !this.isPterodactylConfigured;
  },
};

export function updateDynamicConfig(settings: {
  pterodactylUrl?: string;
  clientApiKey?: string;
  applicationApiKey?: string;
  jwtSecret?: string;
}) {
  if (settings.pterodactylUrl !== undefined) {
    dbSettings.set('PTERODACTYL_PANEL_URL', settings.pterodactylUrl.trim());
  }
  if (settings.clientApiKey !== undefined) {
    dbSettings.set('PTERODACTYL_CLIENT_API_KEY', settings.clientApiKey.trim());
  }
  if (settings.applicationApiKey !== undefined) {
    dbSettings.set('PTERODACTYL_APPLICATION_API_KEY', settings.applicationApiKey.trim());
  }
  if (settings.jwtSecret !== undefined) {
    dbSettings.set('JWT_SECRET', settings.jwtSecret.trim());
  }
}
