/**
 * RexaCloud Nest and Egg Management
 * Inspects and organizes game server templates, docker images, and startup parameters.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { AdminNest } from '@/shared/types';
import { Layers, Plus, Code, Package, Loader2 } from 'lucide-react';

export const NestEggManagementPage: React.FC = () => {
  const [nests, setNests] = useState<AdminNest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNest, setSelectedNest] = useState<AdminNest | null>(null);

  useEffect(() => {
    loadNests();
  }, []);

  const loadNests = async () => {
    setIsLoading(true);
    try {
      const res = await api.listNests();
      setNests(res.nests);
      if (res.nests.length > 0) setSelectedNest(res.nests[0]);
    } catch (err) {
      console.error('Failed to load nests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const [infoModalOpen, setInfoModalOpen] = useState(false);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Nests &amp; Eggs Catalog</h1>
          <p className="text-xs text-slate-400 mt-1">
            Game templates, Docker container images, and startup arguments configured in Pterodactyl
          </p>
        </div>

        <button
          onClick={() => setInfoModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Egg Configuration Guide</span>
        </button>
      </div>

      {infoModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-fadeIn text-xs text-slate-300">
            <h3 className="text-base font-bold text-white">Importing &amp; Managing Eggs</h3>
            <p>
              In Pterodactyl architecture, Eggs and Nests are authoritative templates stored directly in your Pterodactyl Panel.
            </p>
            <div className="space-y-2 bg-[#140E24] p-3 rounded-xl border border-purple-900/20 font-mono text-[11px]">
              <div>1. Open your Pterodactyl Panel Administrative Area.</div>
              <div>2. Navigate to <strong>Nests &gt; Import Egg</strong>.</div>
              <div>3. Upload any official community Egg JSON file (e.g. from parkervcp/eggs).</div>
              <div>4. RexaCloud will automatically detect and expose the new Egg in the Server Creation Wizard.</div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInfoModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Fetching Egg catalog...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Nests list */}
          <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-4 space-y-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Available Nests
            </h2>
            {nests.map((nest) => (
              <button
                key={nest.id}
                onClick={() => setSelectedNest(nest)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                  selectedNest?.id === nest.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-purple-950/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  <span>{nest.name}</span>
                </div>
                <span className="text-[10px] opacity-80">{nest.eggs.length} eggs</span>
              </button>
            ))}
          </div>

          {/* Eggs in selected Nest */}
          <div className="md:col-span-3 space-y-4">
            {selectedNest && (
              <>
                <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5">
                  <h2 className="text-lg font-bold text-white">{selectedNest.name} Eggs</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedNest.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedNest.eggs.map((egg) => (
                    <div
                      key={egg.id}
                      className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-3 hover:border-purple-600/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Package className="w-5 h-5 text-purple-400" />
                        <h3 className="text-sm font-bold text-white">{egg.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400">{egg.description}</p>

                      <div className="space-y-1 text-xs font-mono pt-2">
                        <div className="text-[10px] text-slate-500">Docker Image:</div>
                        <div className="text-purple-300 bg-[#150F25] p-2 rounded-lg truncate">
                          {egg.dockerImage}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs font-mono">
                        <div className="text-[10px] text-slate-500">Startup Command:</div>
                        <div className="text-slate-300 bg-[#150F25] p-2 rounded-lg text-[11px] truncate">
                          {egg.startup}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
