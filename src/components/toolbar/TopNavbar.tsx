import React, { useRef } from 'react';
import {
  MousePointer,
  Square,
  Type,
  Frame,
  Undo2,
  Redo2,
  Code2,
  Sparkles,
  Download,
  Upload,
} from 'lucide-react';
import { useDesignStore, ToolType } from '../../store/useDesignStore';
import { serializePenDocument, deserializePenDocument } from '../../core/io/pen-file-handler';
import { BrandLogo } from '../brand/BrandLogo';
import { BRAND } from '../../lib/brand';

interface TopNavbarProps {
  onToggleCodeModal: () => void;
  onToggleAdvisor: () => void;
  isAdvisorOpen: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  onToggleCodeModal,
  onToggleAdvisor,
  isAdvisorOpen,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    document: doc,
    loadDocument,
    activeTool,
    setActiveTool,
    undo,
    redo,
    historyIndex,
    history,
  } = useDesignStore();

  const handleExportPen = () => {
    const jsonStr = serializePenDocument(doc);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = 'design.pen';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = deserializePenDocument(text);
        loadDocument(parsed);
      } catch (err) {
        alert('Failed to parse .pen file: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const tools: { id: ToolType; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Select (V)', icon: <MousePointer className="h-3.5 w-3.5" /> },
    { id: 'frame', label: 'Frame (F)', icon: <Frame className="h-3.5 w-3.5" /> },
    { id: 'rect', label: 'Rectangle (R)', icon: <Square className="h-3.5 w-3.5" /> },
    { id: 'text', label: 'Text (T)', icon: <Type className="h-3.5 w-3.5" /> },
  ];

  return (
    <header className="flex h-12 w-full items-center justify-between border-b border-zinc-800/80 bg-zinc-900/70 px-3 backdrop-blur-md select-none z-10">
      {/* Brand & File Operations */}
      <div className="flex items-center gap-3">
        <BrandLogo size={28} />
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs tracking-wide text-zinc-200">{BRAND.name}</span>
          <span className="text-[10px] text-zinc-500 font-mono">v2.13</span>
        </div>

        <div className="h-4 w-[1px] bg-zinc-800 ml-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pen,.json"
          onChange={handleImportPen}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 px-2 py-1 rounded transition"
          title="Import .pen file"
        >
          <Upload className="h-3 w-3" />
          <span>Import</span>
        </button>
        <button
          onClick={handleExportPen}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 px-2 py-1 rounded transition"
          title="Export as .pen file"
        >
          <Download className="h-3 w-3" />
          <span>Save .pen</span>
        </button>
      </div>

      {/* Creation Tools */}
      <div className="flex items-center gap-1 bg-zinc-950/80 p-0.5 rounded-lg border border-zinc-800/70">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition ${
              activeTool === t.id
                ? 'bg-zinc-800 text-zinc-100 font-medium shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
            title={t.label}
          >
            {t.icon}
            <span>{t.id.charAt(0).toUpperCase() + t.id.slice(1)}</span>
          </button>
        ))}
      </div>

      {/* Action Controls: History, Code Sync, Advisor, MCP */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5 border-r border-zinc-800 pr-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 transition"
            title="Undo (Cmd+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-400 transition"
            title="Redo (Cmd+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          onClick={onToggleCodeModal}
          className="flex items-center gap-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700/80 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-700/60 transition"
        >
          <Code2 className="h-3.5 w-3.5 text-zinc-400" />
          <span>React JSX</span>
        </button>

        <button
          onClick={onToggleAdvisor}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition shadow-sm border ${
            isAdvisorOpen
              ? 'bg-purple-600/30 text-purple-200 border-purple-500/60'
              : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border-purple-500/40'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
          <span>Claude Opus Advisor</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[11px]">MCP:32100</span>
        </div>
      </div>
    </header>
  );
};
