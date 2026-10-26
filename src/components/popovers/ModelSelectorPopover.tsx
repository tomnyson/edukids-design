import React, { useState } from 'react';
import { Search, ChevronRight, Check } from 'lucide-react';
import { useDesignStore, ReasoningEffort } from '../../store/useDesignStore';

interface ModelSelectorPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const ModelSelectorPopover: React.FC<ModelSelectorPopoverProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onSelectModel,
}) => {
  const [search, setSearch] = useState('');
  const [hoveredModel, setHoveredModel] = useState<string>('pen.dev Pro - MiniMax M3.1 Flash');
  const { reasoningEffort, setReasoningEffort } = useDesignStore();

  if (!isOpen) return null;

  const modelGroups = [
    {
      group: 'PEN.DEV',
      models: [
        'pen.dev Pro - MiniMax M3.1 Flash',
        'pen.dev Pro - MiniMax M3',
        'pen.dev Pro - GLM 5.3 Flash',
        'pen.dev Pro - Qwen 3.8 Max',
        'pen.dev Pro - DeepSeek V4.1 Flash',
      ],
    },
    {
      group: 'ANTHROPIC',
      models: [
        'Claude Fable 5.1',
        'Claude Opus 5.5',
        'Claude Opus 4.5',
        'Claude 3 Opus',
        'Claude 3.5 Sonnet',
      ],
    },
    {
      group: 'OPENAI',
      models: [
        'GPT-4o (ChatGPT)',
        'o3-mini (Reasoning)',
        'GPT-4.5 Preview',
      ],
    },
  ];

  const effortLevels: { id: ReasoningEffort; label: string }[] = [
    { id: 'minimal', label: 'Minimal' },
    { id: 'low', label: 'Low' },
    { id: 'medium', label: 'Medium' },
    { id: 'high', label: 'High' },
    { id: 'very_high', label: 'Very high' },
  ];

  const filteredGroups = modelGroups
    .map((g) => ({
      ...g,
      models: g.models.filter((m) => m.toLowerCase().includes(search.toLowerCase())),
    }))
    .filter((g) => g.models.length > 0);

  return (
    <>
      {/* Click outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute bottom-12 left-12 z-50 flex select-none text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
        {/* Primary Model List Box */}
        <div className="w-64 rounded-xl bg-[#171825] border border-[#2b2d42] shadow-2xl overflow-hidden flex flex-col">
          {/* Search Bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#24263a] bg-[#12131e]">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Models Scroll Area */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-2">
            {filteredGroups.map((g) => (
              <div key={g.group} className="space-y-0.5">
                <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                  {g.group}
                </div>
                {g.models.map((m) => {
                  const isSelected = selectedModel === m;
                  const isHovered = hoveredModel === m;

                  return (
                    <button
                      key={m}
                      onClick={() => {
                        onSelectModel(m);
                        onClose();
                      }}
                      onMouseEnter={() => setHoveredModel(m)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                        isSelected || isHovered
                          ? 'bg-[#222436] text-white'
                          : 'text-zinc-300 hover:bg-[#1d1f30]'
                      }`}
                    >
                      <span className="truncate pr-2">{m}</span>
                      <ChevronRight className="h-3 w-3 text-zinc-500 flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Flyout Sub-menu: EFFORT (Reasoning level) */}
        <div className="w-36 ml-1.5 rounded-xl bg-[#181926] border border-[#2b2d42] p-1.5 shadow-2xl flex flex-col justify-start self-start">
          <div className="px-2.5 py-1 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
            EFFORT
          </div>
          <div className="space-y-0.5">
            {effortLevels.map((eff) => {
              const isEffortSelected = reasoningEffort === eff.id;
              return (
                <button
                  key={eff.id}
                  onClick={() => setReasoningEffort(eff.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition text-left cursor-pointer ${
                    isEffortSelected
                      ? 'bg-[#282a3e] text-white font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1e2030]'
                  }`}
                >
                  <span>{eff.label}</span>
                  {isEffortSelected && <Check className="h-3 w-3 text-purple-400" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};
