import React from 'react';
import { PenTool, Bot, Sparkles, Layers, Sliders, Play, Code2 } from 'lucide-react';

export default function App() {
  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100 font-sans">
      {/* Top Navigation */}
      <header className="flex h-12 w-full items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/40">
            <PenTool className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm tracking-wide text-zinc-200">
            Pen Studio <span className="text-xs text-orange-400 font-mono font-normal">v2.13-compat</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1 text-xs text-zinc-300 border border-zinc-700/60 transition">
            <Code2 className="h-3.5 w-3.5 text-zinc-400" />
            <span>Code Sync</span>
          </button>
          <button className="flex items-center gap-1.5 rounded-md bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 px-3 py-1 text-xs font-medium transition shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Claude Opus Advisor</span>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>MCP Ready (:32100)</span>
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Layer / Document Tree */}
        <aside className="w-64 border-r border-zinc-800/70 bg-zinc-900/40 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 text-xs font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Layers
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">0 nodes</span>
          </div>
          <div className="flex-1 p-3 text-xs text-zinc-500 text-center flex items-center justify-center">
            No elements on canvas
          </div>
        </aside>

        {/* Central Canvas Viewport */}
        <main className="flex-1 relative overflow-hidden bg-zinc-950 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-zinc-400 text-sm font-medium">Infinite Design-as-Code Canvas</p>
            <p className="text-zinc-600 text-xs font-mono">Ready to load .pen document or receive agent MCP commands</p>
          </div>
        </main>

        {/* Right Properties Inspector */}
        <aside className="w-72 border-l border-zinc-800/70 bg-zinc-900/40 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60 text-xs font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              Inspector
            </span>
          </div>
          <div className="p-3 text-xs text-zinc-500 text-center flex-1 flex items-center justify-center">
            Select an element to view properties
          </div>
        </aside>
      </div>
    </div>
  );
}
