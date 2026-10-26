import React from 'react';
import {
  FileText,
  Plus,
  Share2,
  Gift,
  Play,
  Globe,
} from 'lucide-react';

interface WindowChromeProps {
  onPlayPreview: () => void;
  onImportWeb: () => void;
  onShare: () => void;
  onConnectAgents?: () => void;
}

export const WindowChrome: React.FC<WindowChromeProps> = ({
  onPlayPreview,
  onImportWeb,
  onShare,
  onConnectAgents,
}) => {
  return (
    <header className="flex h-11 w-full items-center justify-between border-b border-[#232533] bg-[#0c0d12] px-3.5 select-none z-30">
      {/* Left: macOS Window Controls & Tabs */}
      <div className="flex items-center gap-3">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-2 pr-1">
          <div className="h-3 w-3 rounded-full bg-[#ff5f56] hover:opacity-80 transition cursor-pointer" />
          <div className="h-3 w-3 rounded-full bg-[#ffbd2e] hover:opacity-80 transition cursor-pointer" />
          <div className="h-3 w-3 rounded-full bg-[#27c93f] hover:opacity-80 transition cursor-pointer" />
        </div>

        {/* Brand Icon & Name */}
        <div className="flex items-center gap-1.5 pl-1 pr-2 text-zinc-300">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold text-[10px]">
            P
          </div>
          <span className="text-xs font-semibold tracking-tight text-zinc-200">pen.dev</span>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 bg-[#1b1c26] text-zinc-200 px-3 py-1 rounded-md text-xs border border-[#2b2d3d] shadow-sm">
            <FileText className="h-3.5 w-3.5 text-zinc-400" />
            <span className="font-mono text-[11px]">untitled.pen</span>
          </div>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-[#1b1c26] transition"
            title="New Document"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Actions, Avatar & Free Badge */}
      <div className="flex items-center gap-2.5">
        {/* Share Button */}
        <button
          onClick={onShare}
          className="flex items-center gap-1.5 rounded-md bg-[#161720] hover:bg-[#20222e] text-zinc-300 px-2.5 py-1 text-xs border border-[#262838] transition font-medium"
        >
          <Share2 className="h-3.5 w-3.5 text-zinc-400" />
          <span>Share</span>
        </button>

        {/* Gift Button */}
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-[#161720] transition"
          title="Rewards & Referral"
        >
          <Gift className="h-3.5 w-3.5" />
        </button>

        {/* Play / Interactive Preview */}
        <button
          onClick={onPlayPreview}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#161720] transition"
          title="Preview Prototype"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
        </button>

        {/* Browser Import */}
        <button
          onClick={onImportWeb}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#161720] transition"
          title="Import Website to Canvas"
        >
          <Globe className="h-3.5 w-3.5" />
        </button>

        {/* Connect External Agents (agy, codeope, chatgpt) */}
        {onConnectAgents && (
          <button
            onClick={onConnectAgents}
            className="flex items-center gap-1 bg-[#1a1b28] hover:bg-[#25283b] text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-md text-[11px] font-mono transition"
            title="Connect Antigravity, OpenCode, ChatGPT"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
            </span>
            <span>Connect Agents</span>
          </button>
        )}

        {/* User Avatar */}
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700 cursor-pointer">
          T
        </div>

        {/* Free Plan Badge */}
        <div className="rounded-full bg-[#161720] px-2 py-0.5 text-[10px] font-medium text-zinc-400 border border-[#2a2c3d]">
          Free
        </div>
      </div>
    </header>
  );
};
