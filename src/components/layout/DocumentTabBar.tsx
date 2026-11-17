import React from 'react';
import { FileText, House, Plus, X } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';

interface DocumentTabBarProps {
  onNewDocument: () => void;
  onCloseTab: (id: string) => void;
}

export const DocumentTabBar: React.FC<DocumentTabBarProps> = ({ onNewDocument, onCloseTab }) => {
  const { tabs, activeTabId, documentName, isDirty, switchTab, view, showHome } = useDesignStore();
  const onHome = view === 'home';

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button
        onClick={showHome}
        aria-pressed={onHome}
        aria-label="Home"
        title="Home"
        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/60 ${
          onHome ? 'bg-[#1b1c26] text-zinc-200' : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#1b1c26]'
        }`}
      >
        <House className="h-3.5 w-3.5" />
      </button>
      <div role="tablist" aria-label="Open documents" className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          // The active tab's live state is mirrored at the top level of the store
          const isLive = tab.id === activeTabId;
          const isActive = isLive && !onHome;
          const name = isLive ? documentName : tab.name;
          const dirty = isLive ? isDirty : tab.isDirty;
          return (
            <div
              key={tab.id}
              className={`group flex flex-shrink-0 items-center gap-1.5 rounded-md border pl-2.5 pr-1 py-1 text-xs transition ${
                isActive
                  ? 'bg-[#1b1c26] text-zinc-200 border-[#2b2d3d] shadow-sm'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-[#14151d]'
              }`}
              onAuxClick={(e) => {
                if (e.button === 1) onCloseTab(tab.id);
              }}
            >
              <button
                role="tab"
                aria-selected={isActive}
                onClick={() => switchTab(tab.id)}
                className="flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/60 rounded"
                title={dirty ? `${name} (chưa lưu)` : name}
              >
                <FileText className={`h-3.5 w-3.5 ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`} />
                <span className="max-w-[140px] truncate font-mono text-[11px]">{name}</span>
              </button>
              <button
                onClick={() => onCloseTab(tab.id)}
                aria-label={`Close ${name}`}
                className="relative flex h-4 w-4 items-center justify-center rounded text-zinc-500 hover:bg-[#2a2c3d] hover:text-zinc-200 transition"
              >
                {dirty && <span className="absolute h-1.5 w-1.5 rounded-full bg-orange-400 group-hover:hidden" />}
                <X
                  className={`h-3 w-3 ${dirty ? 'hidden group-hover:block' : isActive ? '' : 'opacity-0 group-hover:opacity-100'}`}
                />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onNewDocument}
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#1b1c26] transition cursor-pointer"
        title="New Tab"
        aria-label="New document tab"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
