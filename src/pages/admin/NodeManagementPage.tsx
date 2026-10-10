/**
 * RexaCloud Infrastructure Nodes Management
 * Lists physical compute nodes running Wings daemon with memory and disk allocations.
 * Includes a 10-step guided Node Setup & Diagnostics workflow for administrators.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { AdminNode, NodeReadiness } from '@/shared/types';
import {
  Cpu,
  Server,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  RefreshCw,
  HelpCircle,
  Check,
  ChevronRight,
  Network,
  X,
  ExternalLink,
} from 'lucide-react';

export const NodeManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Inspector modal state
  const [selectedNode, setSelectedNode] = useState<AdminNode | null>(null);
  const [readinessData, setReadinessData] = useState<NodeReadiness | null>(null);
  const [isLoadingReadiness, setIsLoadingReadiness] = useState(false);

  // Guided Setup Workflow Modal state
  const [setupWorkflowOpen, setSetupWorkflowOpen] = useState(false);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    setIsLoading(true);
    try {
      const res = await api.listNodes();
      setNodes(res.nodes);
      setIsConfigured(res.configured);
    } catch (err) {
      console.error('Failed to load nodes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectNode = async (node: AdminNode) => {
    setSelectedNode(node);
    setIsLoadingReadiness(true);
    setReadinessData(null);
    try {
      const res = await api.getNodeReadiness(node.id);
      setReadinessData(res.readiness);
    } catch (err) {
      console.error('Failed to inspect node readiness:', err);
    } finally {
      setIsLoadingReadiness(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Compute Nodes</h1>
          <p className="text-xs text-slate-400 mt-1">
            Physical bare-metal and virtualized hosts executing Pterodactyl Wings daemon
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setSetupWorkflowOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201833] text-purple-300 border border-purple-900/40 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span>Guided Node Setup</span>
          </button>

          <Link
            to="/admin/create-server"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Server</span>
          </Link>
        </div>
      </div>

      {/* Disconnected Notice if Pterodactyl is not linked */}
      {!isConfigured && (
        <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-800/40 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Pterodactyl Panel Connection Required</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
                RexaCloud connects to nodes via the Pterodactyl Application API. Nodes are registered and managed in your Pterodactyl Panel.
                Configure your API credentials in Settings to inspect live compute nodes.
              </p>
            </div>
          </div>
          <div className="pt-2">
            <Link
              to="/admin/settings"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all"
            >
              <span>Connect Pterodactyl in Settings</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 2. Nodes Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Connecting to node telemetry daemon...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {nodes.length === 0 ? (
            <div className="col-span-full bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
              <Cpu className="w-10 h-10 text-purple-400/50 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Compute Nodes Available</h3>
              <p className="text-xs max-w-md mx-auto">
                No active Wings nodes were returned by your Pterodactyl Panel. Follow the guided setup workflow to configure a node in Pterodactyl.
              </p>
              <button
                onClick={() => setSetupWorkflowOpen(true)}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Open Guided Node Setup</span>
              </button>
            </div>
          ) : (
            nodes.map((node) => {
              const memGB = (node.memoryAllocated / 1024).toFixed(0);
              const memTotalGB = (node.memory / 1024).toFixed(0);
              const memPercent = Math.round((node.memoryAllocated / (node.memory || 1)) * 100);

              const diskGB = (node.diskAllocated / 1024).toFixed(0);
              const diskTotalGB = (node.disk / 1024).toFixed(0);
              const diskPercent = Math.round((node.diskAllocated / (node.disk || 1)) * 100);

              return (
                <div
                  key={node.id}
                  className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-4 shadow-sm hover:border-purple-600/30 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                          <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{node.name}</h3>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{node.fqdn}:{node.daemonListen}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full border ${
                          node.status === 'online'
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            node.status === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        {node.status.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2">
                      {node.description || `Pterodactyl Wings compute host #${node.id}`}
                    </p>

                    {/* Telemetry Progress Bars */}
                    <div className="space-y-3 pt-1 text-xs">
                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Physical RAM Allocated</span>
                          <span className="font-mono text-white">{memGB} / {memTotalGB} GB ({memPercent}%)</span>
                        </div>
                        <div className="w-full bg-[#181228] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${memPercent > 90 ? 'bg-rose-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(100, memPercent)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-slate-400 mb-1">
                          <span>Disk Allocated</span>
                          <span className="font-mono text-white">{diskGB} / {diskTotalGB} GB ({diskPercent}%)</span>
                        </div>
                        <div className="w-full bg-[#181228] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${diskPercent > 90 ? 'bg-rose-500' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(100, diskPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-purple-900/20 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">
                      {node.serversCount} Containers
                    </span>

                    <button
                      onClick={() => handleInspectNode(node)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201833] text-purple-300 border border-purple-900/40 transition-colors cursor-pointer"
                    >
                      Inspect Readiness
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Node Readiness Inspector Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/25">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{selectedNode.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedNode.fqdn}:{selectedNode.daemonListen}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isLoadingReadiness ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                <p className="text-xs">Probing Wings daemon socket and querying allocations...</p>
              </div>
            ) : readinessData ? (
              <div className="space-y-4 text-xs">
                {/* Readiness Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    readinessData.readinessStatus === 'READY'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  {readinessData.readinessStatus === 'READY' ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  )}
                  <div>
                    <div className="font-bold text-sm">
                      Readiness Status: {readinessData.readinessStatus}
                    </div>
                    <p className="mt-0.5 leading-relaxed opacity-90">{readinessData.message}</p>
                  </div>
                </div>

                {/* Status Metrics */}
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/25">
                    <span className="text-slate-400 block text-[11px]">Wings Daemon Ping</span>
                    <span className={readinessData.wingsOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {readinessData.wingsOnline ? 'RESPONDING' : 'OFFLINE / UNREACHABLE'}
                    </span>
                  </div>
                  <div className="bg-[#140E24] p-3 rounded-xl border border-purple-900/25">
                    <span className="text-slate-400 block text-[11px]">Free Port Allocations</span>
                    <span className="text-purple-300 font-bold">
                      {readinessData.availableAllocations} / {readinessData.totalAllocations} Available
                    </span>
                  </div>
                </div>

                {/* Available Allocations List */}
                <div className="space-y-1.5">
                  <span className="text-slate-300 font-semibold block">Unassigned Port Allocations</span>
                  {readinessData.allocations.length === 0 ? (
                    <p className="text-slate-500 italic bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                      No unassigned IP:port allocations available on this node. Add allocations in Pterodactyl Admin &gt; Nodes &gt; Allocations.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-[#140E24] rounded-xl border border-purple-900/20">
                      {readinessData.allocations.slice(0, 15).map((a) => (
                        <span
                          key={a.id}
                          className="px-2.5 py-1 rounded-lg bg-purple-950/40 text-purple-300 border border-purple-900/40 font-mono text-[11px]"
                        >
                          {a.ip}:{a.port}
                        </span>
                      ))}
                      {readinessData.allocations.length > 15 && (
                        <span className="text-slate-500 self-center text-[11px]">
                          +{readinessData.allocations.length - 15} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-900/20">
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    Close
                  </button>
                  <Link
                    to="/admin/create-server"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all"
                  >
                    Deploy Server on this Node
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 4. 10-Step Guided Node Setup Workflow Modal */}
      {setupWorkflowOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl w-full max-w-2xl p-6 sm:p-8 space-y-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/25">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>10-Step Administrator Node Connection Guide</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Standardized workflow to establish and verify Pterodactyl Panel, Nodes, and Wings integration
                </p>
              </div>
              <button
                onClick={() => setSetupWorkflowOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-purple-950/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <ol className="space-y-3.5 list-none">
                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                  <div>
                    <strong className="text-white block font-semibold">Configure Pterodactyl Panel Base URL</strong>
                    Set your Pterodactyl URL (e.g. <code className="text-purple-300">https://panel.yourdomain.com</code>) under Admin Settings.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                  <div>
                    <strong className="text-white block font-semibold">Generate Application API Key</strong>
                    In Pterodactyl Admin Area &gt; Application API, generate a key starting with <code className="text-purple-300">ptla_</code> with Read &amp; Write permissions on Nodes, Servers, Locations, and Nests.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
                  <div>
                    <strong className="text-white block font-semibold">Test Server-Side Connection</strong>
                    Click "Test Connection" in Admin Settings to verify the Express backend can reach your Pterodactyl Panel.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">4</span>
                  <div>
                    <strong className="text-white block font-semibold">Retrieve Node Inventory</strong>
                    RexaCloud queries <code className="text-purple-300">/api/application/nodes</code> to discover all registered nodes.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">5</span>
                  <div>
                    <strong className="text-white block font-semibold">Select Target Compute Node</strong>
                    Select the node where game containers should execute.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">6</span>
                  <div>
                    <strong className="text-white block font-semibold">Inspect Node Status &amp; Wings Daemon Socket</strong>
                    Verify the node is not in maintenance and the Wings daemon (<code className="text-purple-300">systemctl status wings</code>) is listening on port 8080 (or 443 with SSL).
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">7</span>
                  <div>
                    <strong className="text-white block font-semibold">Verify Eligible Port Allocations</strong>
                    Ensure the node has unassigned IP:port allocations available in Pterodactyl (e.g. <code className="text-purple-300">25565, 25566</code>).
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">8</span>
                  <div>
                    <strong className="text-white block font-semibold">Enforce Resource Limits (Max 32 GB RAM)</strong>
                    Assign RAM limits up to 32 GB (32,768 MB) per server. RexaCloud strictly validates this on frontend and backend.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">9</span>
                  <div>
                    <strong className="text-white block font-semibold">Dispatch Test Container Request</strong>
                    Submit the server creation wizard to dispatch the payload to Pterodactyl Application API.
                  </div>
                </li>

                <li className="flex items-start gap-3 bg-[#140E24] p-3 rounded-xl border border-purple-900/20">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">10</span>
                  <div>
                    <strong className="text-white block font-semibold">Verify Deployment &amp; Live Terminal Stream</strong>
                    Confirm the container identifier is returned and stream live server console output.
                  </div>
                </li>
              </ol>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-900/20">
              <button
                onClick={() => setSetupWorkflowOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                Close Guide
              </button>
              <Link
                to="/admin/settings"
                onClick={() => setSetupWorkflowOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 transition-all"
              >
                Open Admin Settings
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
