/**
 * RexaCloud Datacenter Location Management
 * Global datacenter zones mapped to Pterodactyl locations.
 * Real Pterodactyl Application API integration.
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { AdminLocation } from '@/shared/types';
import { MapPin, Plus, Server, Globe, Loader2, X, AlertCircle } from 'lucide-react';

export const LocationManagementPage: React.FC = () => {
  const [locations, setLocations] = useState<AdminLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shortCode, setShortCode] = useState('');
  const [longName, setLongName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    setIsLoading(true);
    try {
      const res = await api.listLocations();
      setLocations(res.locations);
    } catch (err) {
      console.error('Failed to load locations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortCode.trim() || !longName.trim()) {
      setFormError('Both short code and description are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await api.createLocation({
        short: shortCode.trim().toUpperCase(),
        long: longName.trim(),
      });
      setIsModalOpen(false);
      setShortCode('');
      setLongName('');
      await loadLocations();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create location in Pterodactyl');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Datacenter Locations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Geographic regions and edge pops hosting RexaCloud gaming infrastructure
          </p>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Location</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <p className="text-xs">Loading datacenter regions...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <Globe className="w-10 h-10 text-purple-400/50 mx-auto" />
          <h3 className="text-sm font-semibold text-white">No Datacenter Locations Found</h3>
          <p className="text-xs max-w-sm mx-auto">
            No locations were returned from your Pterodactyl Panel. Click "Add Location" to register a new region.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="bg-[#100D1A] border border-purple-900/25 rounded-2xl p-5 space-y-3 shadow-sm hover:border-purple-600/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 font-bold font-mono">
                  {loc.short}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{loc.long}</h3>
                  <p className="text-xs text-slate-400 font-mono">Region ID: #{loc.id}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-purple-900/20 flex justify-between items-center text-xs text-slate-400">
                <span>Location Code: <strong className="text-purple-300">{loc.short}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Location Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#100D1A] border border-purple-900/30 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-purple-900/25">
              <h3 className="text-base font-bold text-white">Create New Datacenter Location</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateLocation} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Short Identifier (e.g. FRA, LON, NYC, DAL)</label>
                <input
                  type="text"
                  value={shortCode}
                  onChange={(e) => setShortCode(e.target.value)}
                  placeholder="e.g. FRA"
                  maxLength={10}
                  className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3.5 py-2.5 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold">Description / Region Name</label>
                <input
                  type="text"
                  value={longName}
                  onChange={(e) => setLongName(e.target.value)}
                  placeholder="e.g. Frankfurt Datacenter (EU-Central)"
                  className="w-full bg-[#140E24] border border-purple-900/30 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-900/20">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
