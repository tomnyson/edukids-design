import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  AlertTriangle,
  Info,
  CheckCircle,
  Wand2,
  Key,
  ShieldCheck,
  Grid,
  Layers,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { ClaudeOpusAdvisor, AdvisorCritique } from '../../advisor/ClaudeOpusAdvisor';
import { findNodeById } from '../../core/io/pen-file-handler';

interface AdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdvisorDrawer: React.FC<AdvisorDrawerProps> = ({ isOpen, onClose }) => {
  const { document: doc, selectedNodeIds, updateNode } = useDesignStore();
  const [apiKey, setApiKey] = useState(localStorage.getItem('ant_api_key') || '');
  const [selectedModel, setSelectedModel] = useState('claude-3-opus-20240229');
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [critiques, setCritiques] = useState<AdvisorCritique[]>([]);
  const [appliedPatches, setAppliedPatches] = useState<string[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);

  if (!isOpen) return null;

  const advisor = new ClaudeOpusAdvisor();
  const selectedNode =
    selectedNodeIds.length > 0 ? findNodeById(doc.children, selectedNodeIds[0]) : null;

  const handleConsult = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    try {
      const results = await advisor.consult({
        apiKey,
        model: selectedModel,
        document: doc,
        selectedNode,
        query: queryText,
      });
      setCritiques(results);
    } catch (err) {
      alert('Advisor error: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPatch = (critique: AdvisorCritique) => {
    if (!critique.suggestedPatch) return;
    const { nodeId, patch } = critique.suggestedPatch;
    updateNode(nodeId, patch);
    setAppliedPatches((prev) => [...prev, critique.id]);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('ant_api_key', key);
    setShowKeyModal(false);
  };

  return (
    <div className="fixed top-12 right-0 bottom-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl flex flex-col z-40 select-none text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/70">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-zinc-200">Claude Opus Advisor</h3>
            <p className="text-[10px] text-zinc-500 font-mono">Senior Design & Architecture Critic</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyModal((prev) => !prev)}
            className={`p-1.5 rounded transition ${
              apiKey ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={apiKey ? 'API Key Configured' : 'Configure Anthropic API Key'}
          >
            <Key className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* API Key Modal Banner if opened */}
      {showKeyModal && (
        <div className="p-3 bg-zinc-950 border-b border-zinc-800 text-xs space-y-2">
          <label className="text-[11px] font-semibold text-zinc-400">Anthropic API Key (sk-ant-...)</label>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave blank for built-in Heuristic Mode"
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
            />
            <button
              onClick={() => saveApiKey(apiKey)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded text-xs transition"
            >
              Save
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            {apiKey
              ? 'Connected to Anthropic API (Live Claude Opus reasoning).'
              : 'Using built-in local heuristic analysis engine.'}
          </p>
        </div>
      )}

      {/* Model Selector & Scope Badge */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/80 bg-zinc-900/60 text-[11px]">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
        >
          <option value="claude-3-opus-20240229">claude-3-opus</option>
          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
        </select>

        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[150px]">
          Target: {selectedNode ? `#${selectedNode.id}` : 'Entire Canvas'}
        </span>
      </div>

      {/* Quick Audit Action Buttons */}
      <div className="p-3 border-b border-zinc-800/60 grid grid-cols-3 gap-1.5 bg-zinc-900/30">
        <button
          onClick={() => handleConsult('Audit accessibility and touch targets (WCAG 2.1)')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/50 transition text-center"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 mb-1" />
          <span className="text-[10px] text-zinc-300 leading-tight">WCAG Audit</span>
        </button>

        <button
          onClick={() => handleConsult('Check 8pt spacing grid and typography rhythm')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/50 transition text-center"
        >
          <Grid className="h-3.5 w-3.5 text-blue-400 mb-1" />
          <span className="text-[10px] text-zinc-300 leading-tight">Spacing Grid</span>
        </button>

        <button
          onClick={() => handleConsult('Review component hierarchy and React architecture')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/50 transition text-center"
        >
          <Layers className="h-3.5 w-3.5 text-orange-400 mb-1" />
          <span className="text-[10px] text-zinc-300 leading-tight">Architecture</span>
        </button>
      </div>

      {/* Critiques Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading && (
          <div className="flex flex-col items-center justify-center h-40 text-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
            <span className="text-xs text-purple-400 font-mono">Claude Opus evaluating canvas...</span>
          </div>
        )}

        {!loading && critiques.length === 0 && (
          <div className="text-center p-8 space-y-2 text-zinc-500 text-xs">
            <Sparkles className="h-8 w-8 text-zinc-700 mx-auto" />
            <p className="font-medium text-zinc-400">Advisor Standing By</p>
            <p className="text-[11px] text-zinc-600">
              Select an element or click a Quick Audit above to get architectural and UX critiques.
            </p>
          </div>
        )}

        {!loading &&
          critiques.map((crit) => {
            const isApplied = appliedPatches.includes(crit.id);
            const severityColor =
              crit.severity === 'critical'
                ? 'text-red-400 border-red-500/40 bg-red-950/20'
                : crit.severity === 'warning'
                ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
                : 'text-blue-400 border-blue-500/40 bg-blue-950/20';

            return (
              <div
                key={crit.id}
                className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2 shadow-sm transition hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${severityColor}`}>
                    {crit.severity} · {crit.category.replace('_', ' ')}
                  </span>
                  {crit.suggestedPatch && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Fix available
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-xs text-zinc-200">{crit.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{crit.observation}</p>
                <div className="text-[11px] text-zinc-300 bg-zinc-900/80 p-2 rounded-lg border border-zinc-800/80">
                  <span className="font-semibold text-purple-300">Advice: </span>
                  {crit.recommendation}
                </div>

                {crit.suggestedPatch && (
                  <button
                    onClick={() => handleApplyPatch(crit)}
                    disabled={isApplied}
                    className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      isApplied
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {isApplied ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Fix Applied to Canvas</span>
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-3.5 w-3.5" />
                        <span>Apply Suggestion</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Consultation Input Bar */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConsult(inputQuery);
            setInputQuery('');
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask Advisor for critique..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 text-white transition"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
