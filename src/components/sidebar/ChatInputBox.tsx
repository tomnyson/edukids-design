import React, { useState } from 'react';
import { Plus, ArrowUp, ChevronDown } from 'lucide-react';

interface ChatInputBoxProps {
  onSend: (prompt: string, model: string) => void;
  isLoading?: boolean;
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({ onSend, isLoading = false }) => {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('Claude Opus 4.5');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const models = [
    'Claude Opus 4.5',
    'Claude Opus 5.5',
    'Claude 3 Opus',
    'Claude 3.5 Sonnet',
  ];

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    onSend(prompt, model);
    setPrompt('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full rounded-2xl bg-[#161722] border border-[#2a2c3e] p-2.5 shadow-xl">
      {/* Input Textarea */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Design anything..."
        rows={2}
        className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none leading-relaxed"
      />

      {/* Bottom Control Bar */}
      <div className="flex items-center justify-between pt-1">
        {/* Left Controls: +, 1x, 1x, Model Picker */}
        <div className="flex items-center gap-1.5 text-zinc-400">
          {/* File Attach Button */}
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[#202231] hover:text-zinc-200 transition text-zinc-400"
            title="Attach images, DESIGN.md or context files"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {/* Speed / Parallel Generation Badges */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1f202e] text-zinc-400 border border-[#2a2c3d]">
              ⚡ 1x
            </span>
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#1f202e] text-zinc-400 border border-[#2a2c3d]">
              🔲 1x
            </span>
          </div>

          {/* Model Selector Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-zinc-300 hover:bg-[#202231] transition font-medium"
            >
              <span>{model}</span>
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute bottom-8 left-0 w-44 rounded-lg bg-[#181924] border border-[#2d2f42] py-1 shadow-2xl z-50">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setModel(m);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition ${
                      model === m
                        ? 'text-orange-400 font-medium bg-[#222436]'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2130]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!prompt.trim() || isLoading}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition ${
            prompt.trim() && !isLoading
              ? 'bg-zinc-200 text-zinc-950 hover:bg-white shadow'
              : 'bg-[#252636] text-zinc-500 cursor-not-allowed'
          }`}
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
