import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  Bot,
} from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { ClaudeOpusAdvisor, AdvisorCritique } from '../../advisor/ClaudeOpusAdvisor';
import { findNodeById } from '../../core/io/pen-file-handler';

interface AdvisorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdvisorDrawer: React.FC<AdvisorDrawerProps> = ({ isOpen, onClose }) => {
  const {
    document: doc,
    selectedNodeIds,
    updateNode,
    isAutoAdvisorEnabled,
    isAutonomousModeEnabled,
    toggleAutoAdvisor,
    toggleAutonomousMode,
    applyAutonomousPatches,
  } = useDesignStore();

  const [antApiKey, setAntApiKey] = useState(localStorage.getItem('ant_api_key') || '');
  const [openAiApiKey, setOpenAiApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [selectedModel, setSelectedModel] = useState('claude-3-opus-20240229');
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [critiques, setCritiques] = useState<AdvisorCritique[]>([]);
  const [appliedPatches, setAppliedPatches] = useState<string[]>([]);
  const [showKeyModal, setShowKeyModal] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const advisor = new ClaudeOpusAdvisor();
  const selectedNode =
    selectedNodeIds.length > 0 ? findNodeById(doc.children, selectedNodeIds[0]) : null;

  // Auto-Advisor & Autonomous Watcher
  useEffect(() => {
    if (!isAutoAdvisorEnabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce 2 seconds after any document change
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await advisor.consult({
          anthropicApiKey: antApiKey,
          openAiApiKey,
          model: selectedModel,
          document: doc,
          selectedNode,
          query: 'Continuous autonomous audit for design system, accessibility and layout',
        });
        setCritiques(results);

        // If autonomous mode is enabled: Auto-apply fixes
        if (isAutonomousModeEnabled && results.length > 0) {
          applyAutonomousPatches(results);
        }
      } catch (err) {
        console.warn('Auto-advisor error:', err);
      }
    }, 2000);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [doc, isAutoAdvisorEnabled, isAutonomousModeEnabled, selectedModel]);

  if (!isOpen) return null;

  const handleConsult = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    try {
      const results = await advisor.consult({
        anthropicApiKey: antApiKey,
        openAiApiKey,
        model: selectedModel,
        document: doc,
        selectedNode,
        query: queryText,
      });
      setCritiques(results);

      if (isAutonomousModeEnabled && results.length > 0) {
        applyAutonomousPatches(results);
      }
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

  const saveApiKeys = () => {
    localStorage.setItem('ant_api_key', antApiKey);
    localStorage.setItem('openai_api_key', openAiApiKey);
    setShowKeyModal(false);
  };

  return (
    <div className="fixed top-11 right-0 bottom-0 w-96 bg-[#101119] border-l border-[#202232] shadow-2xl flex flex-col z-40 select-none text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#202232] bg-[#0c0d13]">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-zinc-200">AI Design Advisor</h3>
            <p className="text-[10px] text-zinc-500 font-mono">Autonomous Co-Pilot (Claude &amp; GPT)</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowKeyModal((prev) => !prev)}
            className={`p-1.5 rounded transition ${
              antApiKey || openAiApiKey ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title="Configure AI API Keys"
          >
            <Key className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="text-zinc-400 hover:text-white p-1 rounded transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Autonomous Controls Bar (Auto-Audit & Auto-Fix Toggles) */}
      <div className="px-4 py-2 border-b border-[#1d1f2e] bg-[#141622] flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Zap className={`h-3.5 w-3.5 ${isAutoAdvisorEnabled ? 'text-amber-400' : 'text-zinc-500'}`} />
          <span className="text-[11px] font-medium text-zinc-300">Tự động hỏi</span>
        </div>
        <button
          onClick={toggleAutoAdvisor}
          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition ${
            isAutoAdvisorEnabled ? 'bg-amber-600' : 'bg-zinc-800'
          }`}
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
              isAutoAdvisorEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>

        <div className="h-3.5 w-[1px] bg-[#27293a] mx-1" />

        <div className="flex items-center gap-1.5">
          <Bot className={`h-3.5 w-3.5 ${isAutonomousModeEnabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
          <span className="text-[11px] font-medium text-zinc-300">Tự quyết định</span>
        </div>
        <button
          onClick={toggleAutonomousMode}
          className={`w-9 h-5 flex items-center rounded-full p-0.5 transition ${
            isAutonomousModeEnabled ? 'bg-emerald-600' : 'bg-zinc-800'
          }`}
          title="Tự động áp dụng cải tiến lên Canvas"
        >
          <div
            className={`bg-white w-4 h-4 rounded-full shadow-md transform transition ${
              isAutonomousModeEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* API Key Modal Banner */}
      {showKeyModal && (
        <div className="p-3 bg-[#0d0e14] border-b border-[#25283b] text-xs space-y-2.5">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-zinc-400">Anthropic API Key (Claude Opus)</label>
            <input
              type="password"
              value={antApiKey}
              onChange={(e) => setAntApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-[#161722] border border-[#27293b] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-zinc-400">OpenAI API Key (ChatGPT / GPT-4o)</label>
            <input
              type="password"
              value={openAiApiKey}
              onChange={(e) => setOpenAiApiKey(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-[#161722] border border-[#27293b] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] text-zinc-500">Keys lưu trong localStorage.</span>
            <button
              onClick={saveApiKeys}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded text-xs transition"
            >
              Lưu Key
            </button>
          </div>
        </div>
      )}

      {/* Model Selector & Scope */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1c1d29] bg-[#0f1018] text-[11px]">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-[#161722] border border-[#25283a] rounded px-2 py-1 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
        >
          <option value="claude-3-opus-20240229">Claude 3 Opus</option>
          <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
          <option value="gpt-4o">OpenAI GPT-4o</option>
          <option value="o3-mini">OpenAI o3-mini</option>
        </select>

        <span className="text-[10px] text-zinc-400 font-mono truncate max-w-[150px]">
          Target: {selectedNode ? `#${selectedNode.id}` : 'Entire Canvas'}
        </span>
      </div>

      {/* Quick Audit Action Buttons */}
      <div className="p-3 border-b border-[#1c1d29] grid grid-cols-3 gap-1.5 bg-[#0e0f17]">
        <button
          onClick={() => handleConsult('Audit accessibility and touch targets (WCAG 2.1)')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#151722] border border-[#242636] hover:border-purple-500/50 hover:bg-[#1d1f2e] transition text-center"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 mb-1" />
          <span className="text-[10px] text-zinc-300 leading-tight">WCAG Audit</span>
        </button>

        <button
          onClick={() => handleConsult('Check 8pt spacing grid and typography rhythm')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#151722] border border-[#242636] hover:border-purple-500/50 hover:bg-[#1d1f2e] transition text-center"
        >
          <Grid className="h-3.5 w-3.5 text-blue-400 mb-1" />
          <span className="text-[10px] text-zinc-300 leading-tight">Spacing Grid</span>
        </button>

        <button
          onClick={() => handleConsult('Review component hierarchy and React architecture')}
          className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#151722] border border-[#242636] hover:border-purple-500/50 hover:bg-[#1d1f2e] transition text-center"
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
            <span className="text-xs text-purple-400 font-mono">Advisor evaluating canvas...</span>
          </div>
        )}

        {!loading && critiques.length === 0 && (
          <div className="text-center p-8 space-y-2 text-zinc-500 text-xs">
            <Sparkles className="h-8 w-8 text-zinc-700 mx-auto" />
            <p className="font-medium text-zinc-400">Advisor Standing By</p>
            <p className="text-[11px] text-zinc-600">
              {isAutoAdvisorEnabled
                ? 'Đang bật Tự động hỏi & Tự quyết định. Bất kỳ thay đổi nào trên Canvas sẽ được tối ưu tự động.'
                : 'Select an element or click a Quick Audit above to get architectural and UX critiques.'}
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
                className="bg-[#141520] border border-[#232535] rounded-xl p-3 space-y-2 shadow-sm transition hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${severityColor}`}>
                    {crit.severity} · {crit.category.replace('_', ' ')}
                  </span>
                  {crit.suggestedPatch && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {isAutonomousModeEnabled ? 'Auto-Fixed' : 'Fix available'}
                    </span>
                  )}
                </div>

                <h4 className="font-semibold text-xs text-zinc-200">{crit.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{crit.observation}</p>
                <div className="text-[11px] text-zinc-300 bg-[#0c0d14] p-2 rounded-lg border border-[#1e202e]">
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
      <div className="p-3 border-t border-[#1c1d29] bg-[#0c0d13]">
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
            className="flex-1 bg-[#161722] border border-[#27293b] rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
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
