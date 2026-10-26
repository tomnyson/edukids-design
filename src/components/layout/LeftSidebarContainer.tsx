import React, { useState } from 'react';
import { AgentChatPanel, SidebarTab } from '../sidebar/AgentChatPanel';
import { LayerTree } from '../sidebar/LayerTree';
import { useDesignStore } from '../../store/useDesignStore';
import { Monitor, Component, Terminal, Layers } from 'lucide-react';

interface LeftSidebarContainerProps {
  onOpenCodeModal: () => void;
  onSendPrompt: (prompt: string, model: string) => void;
  isGenerating?: boolean;
  onOpenBrowserImport?: () => void;
}

export const LeftSidebarContainer: React.FC<LeftSidebarContainerProps> = ({
  onOpenCodeModal,
  onSendPrompt,
  isGenerating,
  onOpenBrowserImport,
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('agent');
  const { document: doc, selectNode, selectedNodeIds } = useDesignStore();

  const handleTabChange = (tab: SidebarTab) => {
    setActiveTab(tab);
    if (tab === 'code') {
      onOpenCodeModal();
    }
  };

  return (
    <div className="flex h-full">
      {activeTab === 'agent' && (
        <AgentChatPanel
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          onSendPrompt={onSendPrompt}
          isGenerating={isGenerating}
          onOpenBrowserImport={onOpenBrowserImport}
        />
      )}

      {activeTab === 'layers' && (
        <div className="w-80 flex flex-col h-full bg-[#0d0e15] border-r border-[#202230]">
          {/* Top Tabs */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1c1d29]">
            <button
              onClick={() => handleTabChange('agent')}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Agent
            </button>
            <button
              onClick={() => handleTabChange('layers')}
              className="px-2.5 py-1 bg-[#1e202e] text-zinc-100 rounded-md border border-[#2d2f44] text-xs font-medium"
            >
              Layers
            </button>
            <button
              onClick={() => handleTabChange('screens')}
              className="p-1.5 text-zinc-500 hover:text-zinc-300"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleTabChange('components')}
              className="p-1.5 text-zinc-500 hover:text-zinc-300"
            >
              <Component className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleTabChange('code')}
              className="p-1.5 text-zinc-500 hover:text-zinc-300"
            >
              <Terminal className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <LayerTree />
          </div>
        </div>
      )}

      {activeTab === 'screens' && (
        <div className="w-80 flex flex-col h-full bg-[#0d0e15] border-r border-[#202230] text-zinc-300 select-none">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1c1d29]">
            <button
              onClick={() => handleTabChange('agent')}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Agent
            </button>
            <button
              onClick={() => handleTabChange('layers')}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Layers
            </button>
            <button
              onClick={() => handleTabChange('screens')}
              className="px-2.5 py-1 bg-[#1e202e] text-zinc-100 rounded-md border border-[#2d2f44] text-xs font-medium"
            >
              Screens ({doc.children.length})
            </button>
          </div>

          <div className="p-3 space-y-2 overflow-y-auto flex-1">
            {doc.children.map((child, i) => (
              <div
                key={child.id}
                onClick={() => selectNode(child.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  selectedNodeIds.includes(child.id)
                    ? 'bg-[#1b1e2e] border-sky-500/50 text-white font-medium'
                    : 'bg-[#141520] border-[#222434] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs truncate">{child.name || `Screen ${i + 1}`}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {child.width}x{child.height}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'components' && (
        <div className="w-80 flex flex-col h-full bg-[#0d0e15] border-r border-[#202230] text-zinc-300 select-none">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1c1d29]">
            <button
              onClick={() => handleTabChange('agent')}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Agent
            </button>
            <button
              onClick={() => handleTabChange('components')}
              className="px-2.5 py-1 bg-[#1e202e] text-zinc-100 rounded-md border border-[#2d2f44] text-xs font-medium"
            >
              Component Library
            </button>
          </div>

          <div className="p-3 space-y-3 overflow-y-auto flex-1 text-xs">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
              Ready-made Blocks
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-[#141520] border border-[#222434] rounded-lg text-center hover:border-zinc-700 cursor-pointer">
                <span>Hero Banner</span>
              </div>
              <div className="p-3 bg-[#141520] border border-[#222434] rounded-lg text-center hover:border-zinc-700 cursor-pointer">
                <span>Pricing Table</span>
              </div>
              <div className="p-3 bg-[#141520] border border-[#222434] rounded-lg text-center hover:border-zinc-700 cursor-pointer">
                <span>Product Card</span>
              </div>
              <div className="p-3 bg-[#141520] border border-[#222434] rounded-lg text-center hover:border-zinc-700 cursor-pointer">
                <span>Footer</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
