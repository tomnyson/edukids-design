import React from 'react';
import { Zap, Lock } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';

interface ParallelAgentsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ParallelAgentsPopover: React.FC<ParallelAgentsPopoverProps> = ({ isOpen, onClose }) => {
  const { parallelAgentsCount, parallelMode, setParallelConfig } = useDesignStore();

  if (!isOpen) return null;

  const counts = [1, 2, 3, 4, 5, 6];

  return (
    <>
      {/* Click outside backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute bottom-12 left-4 w-76 rounded-2xl bg-[#171824] border border-[#2c2e40] p-3.5 shadow-2xl z-50 select-none text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
        <div className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase mb-3">
          PARALLEL AGENTS
        </div>

        {/* Number Selectors: 1x to 6x */}
        <div className="grid grid-cols-6 gap-1.5 mb-3.5">
          {counts.map((n) => {
            const isSelected = parallelAgentsCount === n;
            return (
              <button
                key={n}
                onClick={() => setParallelConfig(n, parallelMode)}
                className={`flex items-center justify-center py-2 rounded-xl text-xs font-mono font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#372f1b] text-amber-400 border border-amber-500/40 shadow-sm'
                    : 'bg-[#1b1c2b] text-zinc-400 hover:text-zinc-200 hover:bg-[#222438] border border-dashed border-[#2f3248]'
                }`}
                title={n > 1 ? `Unlock & run ${n} parallel agents` : '1 single agent'}
              >
                {isSelected || n === 1 ? (
                  <span className="flex items-center gap-0.5">
                    <Zap className="h-3 w-3 fill-current text-amber-400" />
                    {n}x
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-zinc-500">
                    <Lock className="h-2.5 w-2.5 text-zinc-500" />
                    {n}x
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mode Cards: Split Work vs Side by Side */}
        <div className="grid grid-cols-2 gap-2">
          {/* Split Work */}
          <button
            onClick={() => setParallelConfig(parallelAgentsCount, 'split')}
            className={`flex flex-col text-left p-2.5 rounded-xl border transition cursor-pointer ${
              parallelMode === 'split'
                ? 'bg-[#25283c] border-purple-500/50 text-white shadow-md'
                : 'bg-[#1a1b28] border-[#292b3f] text-zinc-400 hover:text-zinc-200 hover:bg-[#202234]'
            }`}
          >
            <span className="text-xs font-bold text-zinc-200 mb-0.5">Split Work</span>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Multiple agents work on different tasks
            </span>
          </button>

          {/* Side by Side */}
          <button
            onClick={() => setParallelConfig(parallelAgentsCount, 'side-by-side')}
            className={`flex flex-col text-left p-2.5 rounded-xl border transition cursor-pointer ${
              parallelMode === 'side-by-side'
                ? 'bg-[#25283c] border-amber-500/50 text-white shadow-md'
                : 'bg-[#1a1b28] border-[#292b3f] text-zinc-400 hover:text-zinc-200 hover:bg-[#202234]'
            }`}
          >
            <span className="text-xs font-bold text-zinc-200 mb-0.5">Side by Side</span>
            <span className="text-[10px] text-zinc-400 leading-tight">
              Multiple agents work on the same task
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
