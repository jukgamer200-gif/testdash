/**
 * RexaCloud File Editor Modal
 * Enables viewing and editing configuration files with syntax/line indicators.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.js';
import { api } from '../../services/api.js';
import { Save, Loader2, Check } from 'lucide-react';

interface FileEditorModalProps {
  serverIdentifier: string;
  filePath: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  serverIdentifier,
  filePath,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && filePath) {
      loadFile();
    }
  }, [isOpen, filePath]);

  const loadFile = async () => {
    if (!filePath) return;
    setIsLoading(true);
    setError(null);
    setSavedSuccess(false);
    try {
      const res = await api.getFileContents(serverIdentifier, filePath);
      setContent(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!filePath) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.writeFile(serverIdentifier, filePath, content);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      if (onSaved) onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setIsSaving(false);
    }
  };

  const lines = content.split('\n');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={filePath ? `Editing: ${filePath}` : 'File Editor'}
      description="Edit configuration and startup files directly on your server container"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            <p className="text-sm font-medium">Fetching file contents from container...</p>
          </div>
        ) : (
          <div className="relative border border-purple-900/40 rounded-xl bg-[#090710] overflow-hidden flex flex-col h-[480px]">
            <div className="flex items-center justify-between px-4 py-2 bg-[#120d20] border-b border-purple-900/30 text-xs text-slate-400 font-mono">
              <span>{lines.length} lines · {content.length} characters</span>
              <span className="text-purple-300">{filePath}</span>
            </div>

            <div className="flex flex-1 overflow-hidden font-mono text-xs">
              {/* Line numbers */}
              <div className="bg-[#0c0915] text-slate-600 select-none py-3 px-3 text-right border-r border-purple-900/20 overflow-hidden font-mono min-w-[45px]">
                {lines.map((_, i) => (
                  <div key={i} className="leading-5">
                    {i + 1}
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="flex-1 bg-transparent text-slate-200 p-3 leading-5 resize-none focus:outline-none focus:ring-0 overflow-auto whitespace-pre font-mono text-xs"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div>
            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <Check className="w-3.5 h-3.5" /> Changes saved to container
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-purple-900/20 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" /> Save Content
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
