import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Bot, Sparkles, CheckCircle2 } from 'lucide-react';

interface AgentConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AgentConnectModal: React.FC<AgentConnectModalProps> = ({ isOpen, onClose }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyCommand = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const agents = [
    {
      id: 'agy',
      name: 'Antigravity CLI (agy)',
      desc: 'Native integration with Google DeepMind Antigravity CLI',
      command: 'npm run mcp:setup',
      configFile: '~/.gemini/antigravity-cli/mcp-servers.json',
      badge: 'Auto-Configured',
    },
    {
      id: 'codeope',
      name: 'OpenCode / Codex (codeope)',
      desc: 'Local MCP connection for OpenCode CLI agent',
      command: 'npx opencode mcp add pen-studio node ' + window.location.origin + '/bin/pen-mcp.js',
      configFile: '~/.config/opencode/mcp.json',
      badge: 'Supported',
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT / OpenAI API',
      desc: 'Use GPT-4o, o3-mini or GPT-4.5 as your real-time design advisor',
      command: 'Export OPENAI_API_KEY=sk-... or enter in Studio Settings',
      configFile: 'localStorage.openai_api_key',
      badge: 'Live Gateway',
    },
    {
      id: 'claude',
      name: 'Claude Code CLI',
      desc: 'Direct connection from Claude Code terminal',
      command: 'claude mcp add pen-studio node ./bin/pen-mcp.js',
      configFile: 'claude_desktop_config.json',
      badge: 'Active',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 select-none text-zinc-100">
      <div className="flex flex-col h-[520px] w-[640px] bg-[#12131d] border border-[#27293b] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#202232] bg-[#0c0d13]">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-orange-400" />
            <h3 className="font-semibold text-sm">Connect External Coding Agents (MCP)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Pen Studio runs a local Model Context Protocol server on stdio &amp; port 32100. Any agent can inspect, draw, and modify canvas artboards in real-time.
          </p>

          <div className="space-y-3">
            {agents.map((ag) => (
              <div
                key={ag.id}
                className="bg-[#171926] border border-[#25283b] rounded-xl p-3.5 space-y-2 hover:border-[#383b54] transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-200">{ag.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#202334] text-orange-400 border border-[#2f3248]">
                      {ag.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">{ag.configFile}</span>
                </div>

                <p className="text-[11px] text-zinc-400">{ag.desc}</p>

                <div className="flex items-center justify-between bg-[#0e0f17] border border-[#202233] px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-300">
                  <span className="truncate pr-2">{ag.command}</span>
                  <button
                    onClick={() => copyCommand(ag.id, ag.command)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition flex-shrink-0"
                  >
                    {copiedKey === ag.id ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{copiedKey === ag.id ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#202232] bg-[#0c0d13] text-xs text-zinc-400">
          <span>Run <code className="text-orange-400 font-mono">npm run mcp:setup</code> to auto-configure all agents.</span>
          <button
            onClick={onClose}
            className="bg-orange-600 hover:bg-orange-500 text-white font-medium px-4 py-1.5 rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
