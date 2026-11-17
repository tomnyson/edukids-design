import React, { useState } from 'react';
import { Plus, ArrowUp, ChevronDown, Zap, LayoutGrid, X, Paperclip, Palette, Box } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { AddToContextPopover } from '../popovers/AddToContextPopover';
import { ParallelAgentsPopover } from '../popovers/ParallelAgentsPopover';
import { ModelSelectorPopover } from '../popovers/ModelSelectorPopover';

/** Resolves false when nothing was produced, so the input can give the prompt back */
export type SendPromptHandler = (prompt: string, model: string) => void | boolean | Promise<boolean | void>;

interface ChatInputBoxProps {
  onSend: SendPromptHandler;
  isLoading?: boolean;
  onOpenBrowserImport?: () => void;
  placeholder?: string;
  /** 'large' is the Home screen's prompt; 'compact' fits the sidebar */
  size?: 'compact' | 'large';
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  onSend,
  isLoading = false,
  onOpenBrowserImport,
  placeholder = 'Design anything...',
  size = 'compact',
}) => {
  const isLarge = size === 'large';
  const [prompt, setPrompt] = useState('');
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isParallelOpen, setIsParallelOpen] = useState(false);
  const [isModelOpen, setIsModelOpen] = useState(false);

  const { contextAttachments, removeContextAttachment, parallelAgentsCount, selectedModel, setSelectedModel, addNode } =
    useDesignStore();

  const handleBrowserImport = () => {
    if (onOpenBrowserImport) {
      onOpenBrowserImport();
    } else {
      const url = window.prompt('Enter website URL to import:', 'https://example.com');
      if (url) {
        addNode({
          type: 'frame',
          name: `Import: ${url}`,
          x: 400,
          y: 80,
          width: 320,
          height: 600,
          fill: '#0f111a',
        });
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPrompt = prompt.trim();
    if ((!cleanPrompt && contextAttachments.length === 0) || isLoading) return;

    setPrompt('');
    // Restore the prompt on failure (missing key, API error) unless the user already typed a new one
    Promise.resolve(onSend(cleanPrompt || 'Generate layout using attached context', selectedModel)).then((sent) => {
      if (sent === false) setPrompt((current) => current || cleanPrompt);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl bg-[#161722] border border-[#2a2c3e] shadow-xl ${
        isLarge ? 'p-3.5 focus-within:border-[#3a3d57] transition-colors' : 'p-2.5'
      }`}
    >
      {/* Context Attachment Tags / Chips */}
      {contextAttachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2 border-b border-[#222434] mb-2">
          {contextAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#202236] border border-[#2d304a] text-[11px] text-zinc-200 animate-in fade-in duration-100"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img src={att.previewUrl} alt="" className="w-3.5 h-3.5 rounded object-cover" />
              ) : att.type === 'style' ? (
                <Palette className="w-3 h-3 text-amber-400" />
              ) : att.type === 'skill' ? (
                <Box className="w-3 h-3 text-emerald-400" />
              ) : (
                <Paperclip className="w-3 h-3 text-sky-400" />
              )}
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button
                type="button"
                onClick={() => removeContextAttachment(att.id)}
                className="text-zinc-500 hover:text-zinc-200 cursor-pointer ml-0.5"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Popovers anchored to input area */}
      <AddToContextPopover
        isOpen={isContextOpen}
        onClose={() => setIsContextOpen(false)}
        onOpenBrowserImport={handleBrowserImport}
      />

      <ParallelAgentsPopover isOpen={isParallelOpen} onClose={() => setIsParallelOpen(false)} />

      <ModelSelectorPopover
        isOpen={isModelOpen}
        onClose={() => setIsModelOpen(false)}
        selectedModel={selectedModel}
        onSelectModel={(m) => setSelectedModel(m)}
      />

      {/* Input Textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={isLarge ? 4 : 2}
        aria-label={placeholder}
        className={`w-full bg-transparent ${isLarge ? 'px-1.5 pt-1 text-sm' : 'text-xs'} text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed`}
      />

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Left Controls: +, ⚡ 1x, ⊞ 1x, Model Picker */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          {/* File Attach Button (+) */}
          <button
            type="button"
            onClick={() => {
              setIsParallelOpen(false);
              setIsModelOpen(false);
              setIsContextOpen((prev) => !prev);
            }}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition cursor-pointer ${
              isContextOpen ? 'bg-[#222438] text-white' : 'text-zinc-400 hover:bg-[#202231] hover:text-zinc-200'
            }`}
            title="Attach images, files, styles or skills"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Speed / Parallel Generation Badges */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            {/* ⚡ 1x (or count) button */}
            <button
              type="button"
              onClick={() => {
                setIsContextOpen(false);
                setIsModelOpen(false);
                setIsParallelOpen((prev) => !prev);
              }}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded transition cursor-pointer ${
                parallelAgentsCount > 1 || isParallelOpen
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-[#1f202e] text-amber-400/90 border border-[#2a2c3d] hover:bg-[#25283a]'
              }`}
              title="Configure parallel generation agents"
            >
              <Zap className="h-2.5 w-2.5 fill-current" />
              <span>{parallelAgentsCount}x</span>
            </button>

            {/* ⊞ 1x (Artboard / Variant count indicator) */}
            <button
              type="button"
              onClick={() => {
                setIsContextOpen(false);
                setIsModelOpen(false);
                setIsParallelOpen((prev) => !prev);
              }}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition cursor-pointer ${
                isParallelOpen
                  ? 'bg-[#27293e] text-zinc-200 border border-[#3b3e58]'
                  : 'bg-[#1f202e] text-zinc-400 border border-[#2a2c3d] hover:bg-[#25283a] hover:text-zinc-200'
              }`}
              title="Configure parallel artboards"
            >
              <LayoutGrid className="h-2.5 w-2.5" />
              <span>{parallelAgentsCount}x</span>
            </button>
          </div>

          {/* Model Selector Pill */}
          <button
            type="button"
            onClick={() => {
              setIsContextOpen(false);
              setIsParallelOpen(false);
              setIsModelOpen((prev) => !prev);
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] transition font-medium cursor-pointer ${
              isModelOpen ? 'bg-[#222438] text-white' : 'text-zinc-300 hover:bg-[#202231] hover:text-white'
            }`}
          >
            <span className="truncate max-w-[130px]">{selectedModel}</span>
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          </button>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={(!prompt.trim() && contextAttachments.length === 0) || isLoading}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition cursor-pointer ${
            (prompt.trim() || contextAttachments.length > 0) && !isLoading
              ? 'bg-zinc-200 text-zinc-950 hover:bg-white shadow'
              : 'bg-[#252636] text-zinc-500 cursor-not-allowed'
          }`}
          title="Send to design agent"
        >
          {isLoading ? (
            <div className="h-3 w-3 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
          )}
        </button>
      </div>
    </div>
  );
};
