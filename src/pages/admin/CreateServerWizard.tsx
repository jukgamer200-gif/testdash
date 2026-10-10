/**
 * RexaCloud Server Creation Wizard (Admin-Only)
 * Multi-step wizard connecting to real Pterodactyl nodes, nests, eggs, and allocations:
 * 1. Server Details (Name, Description, Target User, Nest, Egg)
 * 2. Server Settings (Docker image, startup arguments)
 * 3. Resource Allocation (Node, Allocation Port, RAM limit max 32 GB, CPU, Disk)
 * 4. Confirm & Create (Validation and live submission)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { AdminNode, AdminNest, User } from '@/shared/types';
import {
  ChevronRight,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Server,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Users as UsersIcon,
  HardDrive,
  Network,
} from 'lucide-react';

const MAX_RAM_MB = 32768; // 32 GB Maximum limit per server

export const CreateServerWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdServer, setCreatedServer] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Live Pterodactyl data
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [nodes, setNodes] = useState<AdminNode[]>([]);
  const [nests, setNests] = useState<AdminNest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: 'Survival Server',
    description: '',
    userId: '',
    nestId: 0,
    eggId: 0,
    dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
    startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -jar {{SERVER_JARFILE}}',
    nodeId: 0,
    allocationId: 0,
    memoryMB: 4096, // 4 GB default (Max 32 GB = 32768 MB)
    cpuPercent: 200,
    diskMB: 20480, // 20 GB default
    databasesLimit: 1,
    backupsLimit: 2,
  });

  const steps = [
    { num: 1, title: 'Server Details' },
    { num: 2, title: 'Server Settings' },
    { num: 3, title: 'Resource Allocation' },
    { num: 4, title: 'Confirm & Create' },
  ];

  useEffect(() => {
    loadPterodactylMetadata();
  }, []);

  const loadPterodactylMetadata = async () => {
    setIsLoadingData(true);
    setError(null);
    try {
      const [nodesRes, nestsRes, usersRes] = await Promise.all([
        api.listNodes().catch(() => ({ nodes: [], configured: false })),
        api.listNests().catch(() => ({ nests: [], configured: false })),
        api.listUsers().catch(() => ({ users: [] })),
      ]);

      const fetchedNodes = nodesRes.nodes || [];
      const fetchedNests = nestsRes.nests || [];
      const fetchedUsers = usersRes.users || [];

      setNodes(fetchedNodes);
      setNests(fetchedNests);
      setUsers(fetchedUsers);

      const firstNode = fetchedNodes[0]?.id || 0;
      const firstNest = fetchedNests[0];
      const firstEgg = firstNest?.eggs?.[0];
      const defaultUser = fetchedUsers[0]?.id || '';

      setFormData((prev) => ({
        ...prev,
        nodeId: firstNode,
        nestId: firstNest?.id || 0,
        eggId: firstEgg?.id || 0,
        dockerImage: firstEgg?.dockerImage || prev.dockerImage,
        startup: firstEgg?.startup || prev.startup,
        userId: defaultUser,
      }));

      if (firstNode) {
        loadNodeAllocations(firstNode);
      }
    } catch (err: any) {
      console.error('Failed to load Pterodactyl metadata:', err);
      setError('Unable to load nodes and eggs from Pterodactyl. Please check integration settings.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const loadNodeAllocations = async (nodeId: number) => {
    if (!nodeId) return;
    setIsLoadingAllocations(true);
    try {
      const res = await api.getNodeAllocations(nodeId);
      const available = (res.allocations || []).filter((a: any) => !a.assigned);
      setAllocations(available);
      if (available.length > 0) {
        setFormData((prev) => ({ ...prev, allocationId: available[0].id }));
      } else {
        setFormData((prev) => ({ ...prev, allocationId: 0 }));
      }
    } catch (err) {
      console.error('Failed to load node allocations:', err);
      setAllocations([]);
    } finally {
      setIsLoadingAllocations(false);
    }
  };

  const handleNodeChange = (newNodeId: number) => {
    setFormData((prev) => ({ ...prev, nodeId: newNodeId, allocationId: 0 }));
    loadNodeAllocations(newNodeId);
  };

  const handleNestChange = (newNestId: number) => {
    const nest = nests.find((n) => n.id === newNestId);
    const egg = nest?.eggs?.[0];
    setFormData((prev) => ({
      ...prev,
      nestId: newNestId,
      eggId: egg?.id || 0,
      dockerImage: egg?.dockerImage || prev.dockerImage,
      startup: egg?.startup || prev.startup,
    }));
  };

  const handleEggChange = (newEggId: number) => {
    const nest = nests.find((n) => n.id === formData.nestId);
    const egg = nest?.eggs?.find((e) => e.id === newEggId);
    setFormData((prev) => ({
      ...prev,
      eggId: newEggId,
      dockerImage: egg?.dockerImage || prev.dockerImage,
      startup: egg?.startup || prev.startup,
    }));
  };

  // Validation per step
  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!formData.name.trim()) return 'Server name cannot be empty.';
      if (formData.name.length > 191) return 'Server name cannot exceed 191 characters.';
      if (!formData.eggId) return 'Please select a software Egg template.';
    }
    if (step === 3) {
      if (!formData.nodeId) return 'Please select a deployment node.';
      if (!formData.allocationId) return 'No eligible IP:port allocation selected. Ensure the node has unassigned allocations.';
      if (!formData.memoryMB || isNaN(formData.memoryMB) || formData.memoryMB <= 0) {
        return 'Memory limit must be a positive integer in MB.';
      }
      if (formData.memoryMB > MAX_RAM_MB) {
        return `Memory limit cannot exceed 32 GB (${MAX_RAM_MB} MB) per server.`;
      }
      if (formData.cpuPercent < 0) return 'CPU limit must be 0 or a positive number.';
      if (formData.diskMB <= 0) return 'Disk space must be a positive integer in MB.';
    }
    return null;
  };

  const handleNext = () => {
    const stepError = validateStep(currentStep);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    const validationError = validateStep(3) || validateStep(1);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.createServer({
        name: formData.name.trim(),
        description: formData.description.trim(),
        userId: formData.userId || 1,
        nestId: formData.nestId,
        eggId: formData.eggId,
        nodeId: formData.nodeId,
        allocationId: formData.allocationId,
        dockerImage: formData.dockerImage,
        startup: formData.startup,
        limits: {
          memory: Math.min(Math.max(1, Math.floor(formData.memoryMB)), MAX_RAM_MB),
          swap: 0,
          disk: Math.max(1024, Math.floor(formData.diskMB)),
          io: 500,
          cpu: Math.max(0, Math.floor(formData.cpuPercent)),
        },
        featureLimits: {
          databases: formData.databasesLimit,
          allocations: 1,
          backups: formData.backupsLimit,
        },
        allocation: {
          default: formData.allocationId,
        },
      });

      setCreatedServer(res.server);
    } catch (err: any) {
      setError(err.message || 'Server creation failed. Verify node resources and Pterodactyl API status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-xs">Loading real nodes, nests, and eggs from Pterodactyl...</p>
      </div>
    );
  }

  const selectedNest = nests.find((n) => n.id === formData.nestId) || nests[0];
  const selectedNode = nodes.find((n) => n.id === formData.nodeId);

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* 1. Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link to="/admin" className="hover:text-purple-300 transition-colors">
          Admin
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <Link to="/admin/servers" className="hover:text-purple-300 transition-colors">
          Fleet Servers
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-400 font-semibold">Provision Server</span>
      </div>

      {/* 2. Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Provision Game Server</h1>
        <p className="text-xs text-slate-400 mt-1">
          Administrator-only workflow connected directly to Pterodactyl Application API (Max 32 GB RAM per server)
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Notice if no nodes are available */}
      {nodes.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>No compute nodes connected. Connect your Pterodactyl Panel and configure nodes to provision servers.</span>
          </div>
          <Link to="/admin/settings" className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 text-xs font-semibold shrink-0">
            Open Settings
          </Link>
        </div>
      )}

      {/* Success banner */}
      {createdServer ? (
        <div className="bg-[#100D1A] border border-purple-500/40 rounded-2xl p-8 text-center space-y-4 shadow-xl shadow-purple-950/40">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Server Provisioned Successfully!</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The container has been dispatched to Pterodactyl and allocated to {selectedNode?.name || 'Node'}.
          </p>

          <div className="bg-[#160F25] p-4 rounded-xl max-w-md mx-auto text-left text-xs font-mono text-slate-300 space-y-1.5 border border-purple-900/30">
            <div><span className="text-slate-500">Name:</span> {createdServer.attributes?.name || createdServer.name}</div>
            <div><span className="text-slate-500">Identifier:</span> {createdServer.attributes?.identifier || createdServer.identifier}</div>
            <div><span className="text-slate-500">UUID:</span> {createdServer.attributes?.uuid || createdServer.uuid || '—'}</div>
            <div><span className="text-slate-500">Node:</span> {selectedNode?.name || 'Assigned Node'}</div>
            <div><span className="text-slate-500">RAM:</span> {formData.memoryMB} MB ({(formData.memoryMB / 1024).toFixed(1)} GB)</div>
            <div><span className="text-slate-500">CPU:</span> {formData.cpuPercent}%</div>
          </div>

          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigate('/admin/servers')}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              Fleet Servers
            </button>
            <button
              onClick={() => {
                setCreatedServer(null);
                setCurrentStep(1);
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#171126] hover:bg-[#201833] text-slate-200 border border-purple-900/40 cursor-pointer"
            >
              Create Another
            </button>
          </div>
        </div>
      ) : (
        /* Main Wizard Layout */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          {/* Left Vertical Step Indicator */}
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-3">
            {steps.map((step) => {
              const isCurrent = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <div
                  key={step.num}
                  className={`flex items-center gap-3.5 p-2 rounded-xl transition-all ${
                    isCurrent ? 'bg-purple-950/40 text-white' : 'text-slate-400'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isPast
                        ? 'bg-purple-600 text-white'
                        : isCurrent
                        ? 'bg-purple-600 text-white ring-4 ring-purple-600/20'
                        : 'border border-slate-700 text-slate-500'
                    }`}
                  >
                    {isPast ? <Check className="w-3.5 h-3.5" /> : step.num}
                  </div>
                  <span className="text-xs font-medium">{step.title}</span>
                </div>
              );
            })}
          </div>

          {/* Right Form Card */}
          <div className="md:col-span-3 bg-[#100D1A] border border-purple-900/25 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            {/* Step 1: Server Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Step 1: Server Details &amp; Template
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Server Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Community Survival Server"
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Server Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional notes or description about this server"
                    rows={2}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Target User Assignment */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Assign to User</label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.email}) — [{u.role.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Nest and Egg Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Pterodactyl Nest (Game Type)</label>
                    <select
                      value={formData.nestId}
                      onChange={(e) => handleNestChange(Number(e.target.value))}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {nests.length === 0 ? (
                        <option value={0}>No Nests Found in Pterodactyl</option>
                      ) : (
                        nests.map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Software Egg Template</label>
                    <select
                      value={formData.eggId}
                      onChange={(e) => handleEggChange(Number(e.target.value))}
                      className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {(!selectedNest || !selectedNest.eggs || selectedNest.eggs.length === 0) ? (
                        <option value={0}>No Eggs in Selected Nest</option>
                      ) : (
                        selectedNest.eggs.map((egg) => (
                          <option key={egg.id} value={egg.id}>
                            {egg.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Server Settings */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Step 2: Container Environment &amp; Startup
                </h2>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Docker Image</label>
                  <input
                    type="text"
                    value={formData.dockerImage}
                    onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs font-mono text-purple-300 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-slate-500">Container runtime image defined by the software egg.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Startup Command</label>
                  <textarea
                    value={formData.startup}
                    onChange={(e) => setFormData({ ...formData, startup: e.target.value })}
                    rows={3}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-[11px] text-slate-500">Pterodactyl startup script variables will be interpolated by Wings.</p>
                </div>
              </div>
            )}

            {/* Step 3: Resource Allocation */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Step 3: Node Selection &amp; Resource Limits
                </h2>

                {/* Node Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Deployment Node *</label>
                  <select
                    value={formData.nodeId}
                    onChange={(e) => handleNodeChange(Number(e.target.value))}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {nodes.length === 0 ? (
                      <option value={0}>No Nodes Available</option>
                    ) : (
                      nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.fqdn}) — {(node.memory / 1024).toFixed(0)} GB Total RAM [{node.status.toUpperCase()}]
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Allocation Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">Eligible Node Allocation (IP:Port) *</label>
                    {isLoadingAllocations && <span className="text-[11px] text-purple-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading ports...</span>}
                  </div>
                  <select
                    value={formData.allocationId}
                    onChange={(e) => setFormData({ ...formData, allocationId: Number(e.target.value) })}
                    className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {allocations.length === 0 ? (
                      <option value={0}>No Unassigned Allocations Available on this Node</option>
                    ) : (
                      allocations.map((alloc) => (
                        <option key={alloc.id} value={alloc.id}>
                          {alloc.ip}:{alloc.port} {alloc.alias ? `(${alloc.alias})` : ''} — [Available]
                        </option>
                      ))
                    )}
                  </select>
                  {allocations.length === 0 && !isLoadingAllocations && (
                    <p className="text-[11px] text-rose-400">
                      Cannot provision: selected node has no free port allocations. Add an allocation in Pterodactyl first.
                    </p>
                  )}
                </div>

                {/* Memory Allocation with Strict 32 GB Limit */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">
                      RAM Allocation <span className="text-purple-400 font-normal">(Max 32 GB / 32,768 MB per server)</span>
                    </span>
                    <span className={`font-mono font-bold ${formData.memoryMB > MAX_RAM_MB ? 'text-rose-400' : 'text-purple-400'}`}>
                      {formData.memoryMB} MB ({(formData.memoryMB / 1024).toFixed(1)} GB)
                    </span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {[
                      { label: '1 GB', mb: 1024 },
                      { label: '2 GB', mb: 2048 },
                      { label: '4 GB', mb: 4096 },
                      { label: '8 GB', mb: 8192 },
                      { label: '16 GB', mb: 16384 },
                      { label: '32 GB (Max)', mb: 32768 },
                    ].map((preset) => (
                      <button
                        key={preset.mb}
                        type="button"
                        onClick={() => setFormData({ ...formData, memoryMB: preset.mb })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors cursor-pointer ${
                          formData.memoryMB === preset.mb
                            ? 'bg-purple-600 text-white'
                            : 'bg-[#150F25] text-slate-300 hover:bg-[#1E1535]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min="512"
                    max={MAX_RAM_MB}
                    step="512"
                    value={formData.memoryMB}
                    onChange={(e) => setFormData({ ...formData, memoryMB: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />

                  {formData.memoryMB > MAX_RAM_MB && (
                    <p className="text-[11px] text-rose-400 font-medium">
                      Error: Memory limit exceeds 32 GB ({MAX_RAM_MB} MB). Panel enforces a strict maximum of 32 GB per server.
                    </p>
                  )}
                </div>

                {/* CPU Limit */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">CPU Core Limit (100% = 1 Thread)</span>
                    <span className="text-purple-400 font-bold">{formData.cpuPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="800"
                    step="50"
                    value={formData.cpuPercent}
                    onChange={(e) => setFormData({ ...formData, cpuPercent: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>

                {/* Disk Limit */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-semibold">Disk Space</span>
                    <span className="text-purple-400 font-bold">{formData.diskMB} MB ({(formData.diskMB / 1024).toFixed(0)} GB)</span>
                  </div>
                  <input
                    type="range"
                    min="5120"
                    max="102400"
                    step="5120"
                    value={formData.diskMB}
                    onChange={(e) => setFormData({ ...formData, diskMB: Number(e.target.value) })}
                    className="w-full accent-purple-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Step 4: Confirm & Create */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-white tracking-tight border-b border-purple-900/20 pb-3">
                  Step 4: Confirm &amp; Deploy
                </h2>

                <div className="bg-[#140E24] border border-purple-900/30 rounded-xl p-4 divide-y divide-purple-900/20 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Server Name</span>
                    <span className="font-semibold text-white">{formData.name}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Software Template</span>
                    <span className="font-semibold text-purple-300">
                      {selectedNest?.name} · {selectedNest?.eggs?.find((e) => e.id === formData.eggId)?.name}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Deployment Node</span>
                    <span className="font-semibold text-white">{selectedNode?.name || `Node #${formData.nodeId}`}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Allocation Port</span>
                    <span className="font-mono text-purple-300">
                      {allocations.find((a) => a.id === formData.allocationId)
                        ? `${allocations.find((a) => a.id === formData.allocationId).ip}:${allocations.find((a) => a.id === formData.allocationId).port}`
                        : `Allocation #${formData.allocationId}`}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">RAM Limit</span>
                    <span className="font-semibold text-white">{formData.memoryMB} MB ({(formData.memoryMB / 1024).toFixed(1)} GB)</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">CPU Limit</span>
                    <span className="font-semibold text-white">{formData.cpuPercent}%</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Disk Space</span>
                    <span className="font-semibold text-white">{formData.diskMB} MB</span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Upon dispatch, the Pterodactyl Application API will initialize container files and instruct the node's Wings daemon to pull the Docker image.
                </p>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-purple-900/20">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={Boolean(validateStep(currentStep))}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer disabled:opacity-40"
                >
                  <span>Next Step</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || Boolean(validateStep(3))}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching to Wings...</span>
                    </>
                  ) : (
                    <>
                      <Server className="w-4 h-4" />
                      <span>Deploy Server Container</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
