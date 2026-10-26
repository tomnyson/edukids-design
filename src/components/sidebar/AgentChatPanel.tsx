import React from 'react';
import {
  MessageSquare,
  Layers,
  Monitor,
  Component,
  Terminal,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { ChatInputBox } from './ChatInputBox';

export type SidebarTab = 'agent' | 'layers' | 'screens' | 'components' | 'code';

interface AgentChatPanelProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  onSendPrompt: (prompt: string, model: string) => void;
  isGenerating?: boolean;
}

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  activeTab,
  onSelectTab,
  onSendPrompt,
  isGenerating = false,
}) => {
  const suggestions = [
    'Warm minimal booking site for a Lisbon ceramic studio',
    'Editorial portfolio for an avant-garde fashion label',
    'Retro-futuristic landing page for private space charter',
    'Control panel for a humanoid robotics fleet',
    'Cozy mobile app for tracking houseplants & watering',
    'High-contrast realtime trading terminal with charts',
  ];

  return (
    <div className="flex flex-col h-full bg-[#0d0e15] border-r border-[#202230] select-none text-zinc-300 w-80 flex-shrink-0">
      {/* Top Sidebar Sub-Tabs */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#1c1d29]">
        <button
          onClick={() => onSelectTab('agent')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition ${
            activeTab === 'agent'
              ? 'bg-[#1e202e] text-zinc-100 border border-[#2d2f44]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
          <span>Agent</span>
        </button>

        <button
          onClick={() => onSelectTab('layers')}
          className={`p-1.5 rounded-md transition ${
            activeTab === 'layers'
              ? 'bg-[#1e202e] text-zinc-100 border border-[#2d2f44]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Layers"
        >
          <Layers className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTab('screens')}
          className={`p-1.5 rounded-md transition ${
            activeTab === 'screens'
              ? 'bg-[#1e202e] text-zinc-100 border border-[#2d2f44]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Screens"
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTab('components')}
          className={`p-1.5 rounded-md transition ${
            activeTab === 'components'
              ? 'bg-[#1e202e] text-zinc-100 border border-[#2d2f44]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Components"
        >
          <Component className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => onSelectTab('code')}
          className={`p-1.5 rounded-md transition ${
            activeTab === 'code'
              ? 'bg-[#1e202e] text-zinc-100 border border-[#2d2f44]'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
          title="Code Terminal / MCP"
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Agent Dropdown & New Button */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#1c1d29]/80">
        <button className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#161722] hover:bg-[#1e202f] border border-[#27293a] text-xs font-medium text-zinc-200 transition">
          <span>New Agent</span>
          <ChevronDown className="h-3 w-3 text-zinc-500" />
        </button>

        <button className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-[#1a1b26] transition font-medium">
          <Plus className="h-3.5 w-3.5 text-zinc-500" />
          <span>New</span>
        </button>
      </div>

      {/* Scrollable Guidance & Suggestion Area */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-4">
        {/* Suggestion Prompts Section */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-medium text-zinc-400">Ask me to design anything</h4>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSendPrompt(item, 'Claude Opus 4.5')}
                className="text-left text-xs text-zinc-300 bg-[#161722] hover:bg-[#202232] hover:text-white px-3 py-2 rounded-xl border border-[#262838] transition leading-snug truncate"
                title={item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Guidance: Save your design */}
        <div className="space-y-1 pt-1">
          <h5 className="text-[11px] font-semibold text-zinc-300">Save your design</h5>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Use &ldquo;Save As...&rdquo; to save your <span className="font-mono text-orange-400">.pen</span> file in a local folder or project.
          </p>
        </div>

        {/* Guidance: Generate code */}
        <div className="space-y-1">
          <h5 className="text-[11px] font-semibold text-zinc-300">Generate code</h5>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Ask the agent to build your design with React, Tailwind, Next.js, or your preferred stack. For an HTML file, select a frame and click &ldquo;Export HTML&rdquo; in the properties panel.
          </p>
        </div>

        {/* Guidance: Attach context files */}
        <div className="space-y-1">
          <h5 className="text-[11px] font-semibold text-zinc-300">Attach context files</h5>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Drop an PNG/JPG, DESIGN.md or any text file here or attach via +
          </p>
        </div>
      </div>

      {/* Bottom Chat Bar Container */}
      <div className="p-3 bg-[#0d0e15] border-t border-[#1c1d29]">
        <ChatInputBox onSend={onSendPrompt} isLoading={isGenerating} />
      </div>
    </div>
  );
};
