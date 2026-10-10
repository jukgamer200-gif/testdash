/**
 * RexaCloud Panel Settings & Pterodactyl Integration Diagnostics
 * Configures connection credentials, tests reachability, and manages live integration.
 * Real Pterodactyl configuration without demo mode.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { SystemConnectionStatus } from '@/shared/types';
import {
  Settings,
  CheckCircle2,
  AlertCircle,
  Key,
  Globe,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export const PanelSettingsPage: React.FC = () => {
  const { systemStatus, refreshStatus } = useAuth();

  const [panelUrl, setPanelUrl] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [appKey, setAppKey] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<SystemConnectionStatus | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (systemStatus) {
      setPanelUrl(systemStatus.panelUrl || systemStatus.pterodactylUrl || '');
    }
  }, [systemStatus]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setActionError(null);
    try {
      const res = await api.testConnection();
      setTestResult(res.status);
      await refreshStatus();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setActionError(null);
    try {
      const res = await api.updateSystemSettings({
        pterodactylUrl: panelUrl,
        clientApiKey: clientKey || undefined,
        applicationApiKey: appKey || undefined,
      });
      setTestResult(res.status);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await refreshStatus();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const currentStatus = testResult || systemStatus;
  const isConnected = currentStatus?.clientApiConnected || currentStatus?.appApiConnected;

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Pterodactyl Panel Integration</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure secure backend communication with your authoritative Pterodactyl installation
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {isConnected ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Integration Status:{' '}
                <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED / PENDING'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isConnected
                  ? `Connected to ${currentStatus?.panelUrl || 'panel'}`
                  : 'Enter your Pterodactyl Panel URL and API keys below to establish live communication.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201833] text-purple-300 border border-purple-900/40 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Test Connection</span>
          </button>
        </div>

        {/* Diagnostics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs font-mono">
          <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30">
            <span className="text-slate-500 block text-[10px]">Client API</span>
            <span className={currentStatus?.clientApiConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {currentStatus?.clientApiConnected ? 'REACHABLE' : 'UNCONNECTED'}
            </span>
          </div>

          <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30">
            <span className="text-slate-500 block text-[10px]">Application API</span>
            <span className={currentStatus?.appApiConnected ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {currentStatus?.appApiConnected ? 'REACHABLE' : 'UNCONNECTED'}
            </span>
          </div>

          <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30">
            <span className="text-slate-500 block text-[10px]">Latency</span>
            <span className="text-white font-bold">{currentStatus?.latencyMs || 0} ms</span>
          </div>

          <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/30">
            <span className="text-slate-500 block text-[10px]">Configured</span>
            <span className={currentStatus?.configured ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
              {currentStatus?.configured ? 'YES' : 'NO'}
            </span>
          </div>
        </div>

        {currentStatus?.errorMessage && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
            Notice: {currentStatus.errorMessage}
          </div>
        )}
      </div>

      {/* Integration Form */}
      <form onSubmit={handleSave} className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
          Configure API Credentials
        </h2>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>Pterodactyl Panel Base URL</span>
          </label>
          <input
            type="url"
            value={panelUrl}
            onChange={(e) => setPanelUrl(e.target.value)}
            placeholder="https://panel.yourdomain.com"
            required
            className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <p className="text-[11px] text-slate-500">
            The external URL where your Pterodactyl instance is accessible (e.g. https://panel.example.com).
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>Client API Key (ptlc_...)</span>
          </label>
          <input
            type="password"
            value={clientKey}
            onChange={(e) => setClientKey(e.target.value)}
            placeholder="Enter Client API Key"
            className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <p className="text-[11px] text-slate-500">
            Generated from Pterodactyl User Account &gt; API Credentials. Used for server power controls, console, and file manager.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>Application API Key (ptla_...)</span>
          </label>
          <input
            type="password"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            placeholder="Enter Application API Key"
            className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          <p className="text-[11px] text-slate-500">
            Generated from Pterodactyl Admin &gt; Application API with read &amp; write permissions. Used for provisioning servers and managing nodes.
          </p>
        </div>

        {actionError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Configuration saved successfully to database!
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="ml-auto px-6 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
};
