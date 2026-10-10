/**
 * RexaCloud Customer Server Browser
 * Searchable, filterable list of all accessible game servers.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { PterodactylServer } from '../../../shared/types.js';
import { StatusBadge } from '../../components/common/StatusBadge.js';
import {
  Server,
  Terminal,
  Sliders,
  Search,
  Plus,
  Loader2,
  Filter,
} from 'lucide-react';

export const ServerList: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'offline'>('all');

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (queryParam) setSearchTerm(queryParam);
  }, [queryParam]);

  const loadServers = async () => {
    setIsLoading(true);
    try {
      const res = await api.listServers();
      setServers(res.servers);
    } catch (err) {
      console.error('Failed to list servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = servers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.ip.includes(searchTerm);

    const matchesStatus =
      statusFilter === 'all' || s.utilization.state === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Your Servers</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse and manage all game servers allocated to your account
          </p>
        </div>

        {role === 'admin' && (
          <button
            onClick={() => navigate('/admin/create-server')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Server</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by name, identifier, or IP address..."
            className="w-full bg-[#100D1A] border border-purple-900/30 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-[#100D1A] border border-purple-900/30 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({servers.length})
          </button>
          <button
            onClick={() => setStatusFilter('running')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === 'running'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Online ({servers.filter((s) => s.utilization.state === 'running').length})
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === 'offline'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Offline ({servers.filter((s) => s.utilization.state === 'offline').length})
          </button>
        </div>
      </div>

      {/* Servers Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Loading servers list...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Server className="w-10 h-10 text-purple-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No servers match your filters</h3>
          <p className="text-xs max-w-sm mx-auto">
            Try adjusting your search query or create a new game server container.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((server) => {
            const isOnline = server.utilization.state === 'running';
            const ramGB = (server.utilization.memoryBytes / (1024 * 1024 * 1024)).toFixed(1);
            const ramLimitGB = (server.limits.memory / 1024).toFixed(0);

            return (
              <div
                key={server.identifier}
                className="bg-[#100D1A] border border-purple-900/25 hover:border-purple-600/40 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-lg hover:shadow-purple-950/40 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                        {server.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {server.software} · {server.version}
                      </p>
                    </div>
                    <StatusBadge status={server.utilization.state} size="sm" />
                  </div>

                  <div className="text-xs font-mono text-slate-300 bg-purple-950/30 px-3 py-1.5 rounded-xl border border-purple-900/30">
                    {server.ip}:{server.port}
                  </div>

                  <div className="space-y-1.5 text-xs pt-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Node</span>
                      <span className="text-slate-200">{server.node}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>CPU</span>
                      <span className="text-slate-200 font-mono">{server.utilization.cpuAbsolute}% / {server.limits.cpu}%</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>RAM</span>
                      <span className="text-slate-200 font-mono">{ramGB} GB / {ramLimitGB} GB</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5 pt-3 border-t border-purple-900/20">
                  <button
                    onClick={() => navigate(`/server/${server.identifier}/console`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201736] text-slate-200 border border-purple-900/30 transition-colors"
                  >
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    <span>Console</span>
                  </button>

                  <button
                    onClick={() => navigate(`/server/${server.identifier}/settings`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Manage</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
