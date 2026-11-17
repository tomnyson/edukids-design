import React from 'react';
import {
  Share2,
  Gift,
  Play,
  Globe,
} from 'lucide-react';
import { DocumentTabBar } from './DocumentTabBar';
import { FileMenu } from './FileMenu';
import { FileActions } from '../../hooks/useFileActions';
import { BrandLogo } from '../brand/BrandLogo';
import { TitleBarLead } from './TitleBarLead';
import { BRAND, isDesktopApp } from '../../lib/brand';

/** Desktop app: the bar drags the window, and its controls must opt out to stay clickable */
const DRAG_REGION = { WebkitAppRegion: 'drag' } as React.CSSProperties;
const NO_DRAG_REGION = { WebkitAppRegion: 'no-drag' } as React.CSSProperties;

interface WindowChromeProps {
  onPlayPreview: () => void;
  onImportWeb: () => void;
  onShare: () => void;
  onConnectAgents?: () => void;
  fileActions: FileActions;
}

export const WindowChrome: React.FC<WindowChromeProps> = ({
  onPlayPreview,
  onImportWeb,
  onShare,
  onConnectAgents,
  fileActions,
}) => {
  const desktop = isDesktopApp();
  const controlStyle = desktop ? NO_DRAG_REGION : undefined;

  return (
    <header
      className="flex h-11 w-full items-center justify-between border-b border-[#232533] bg-[#0c0d12] px-3.5 select-none z-30"
      style={desktop ? DRAG_REGION : undefined}
    >
      {/* Left: window buttons, brand & tabs */}
      <div className="flex min-w-0 items-center gap-3">
        <TitleBarLead desktop={desktop} />

        {/* Brand Icon & Name */}
        <div className="flex items-center gap-1.5 pl-1 pr-2 text-zinc-300">
          <BrandLogo size={20} />
          <span className="text-xs font-semibold tracking-tight text-zinc-200 whitespace-nowrap">{BRAND.name}</span>
        </div>

        <div className="flex min-w-0 items-center gap-3" style={controlStyle}>
          <FileMenu actions={fileActions} />

          {/* Document Tabs */}
          <DocumentTabBar onNewDocument={fileActions.newDocument} onCloseTab={fileActions.closeTab} />
        </div>
      </div>

      {/* Right: Actions, Avatar & Free Badge */}
      <div className="flex items-center gap-2.5" style={controlStyle}>
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
          disabled
          aria-disabled="true"
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 opacity-50 cursor-not-allowed"
          title="Rewards & Referral (sắp có)"
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
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700">
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
