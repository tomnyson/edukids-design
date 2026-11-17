import React, { useState } from 'react';
import { AgentChatPanel, SidebarTab } from '../sidebar/AgentChatPanel';
import { SendPromptHandler } from '../sidebar/ChatInputBox';
import { LayerTree } from '../sidebar/LayerTree';
import { SlidesPanel, slidesOf } from '../sidebar/SlidesPanel';
import { ComponentsPanel } from '../sidebar/ComponentsPanel';
import { useDesignStore } from '../../store/useDesignStore';
import { Monitor, Component, Terminal, Layers } from 'lucide-react';

interface LeftSidebarContainerProps {
  onOpenCodeModal: () => void;
  onSendPrompt: SendPromptHandler;
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
  const doc = useDesignStore((state) => state.document);

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
              title="Slides"
              aria-label="Slides"
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
              Slides ({slidesOf(doc.children).length})
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <SlidesPanel />
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
              onClick={() => handleTabChange('layers')}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              Layers
            </button>
            <button
              onClick={() => handleTabChange('components')}
              className="px-2.5 py-1 bg-[#1e202e] text-zinc-100 rounded-md border border-[#2d2f44] text-xs font-medium"
            >
              Components
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <ComponentsPanel />
          </div>
        </div>
      )}
    </div>
  );
};
