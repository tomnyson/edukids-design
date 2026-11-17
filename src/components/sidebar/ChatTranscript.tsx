import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, Clock, Loader2 } from 'lucide-react';
import { AgentProgress, ChatMessage } from '../../lib/agent-chat';

interface ChatTranscriptProps {
  messages: ChatMessage[];
}

const BUBBLE_BASE = 'max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words select-text';

function bubbleClass(message: ChatMessage): string {
  if (message.role === 'user') {
    return `${BUBBLE_BASE} self-end bg-[#1e202e] border border-[#2d2f44] text-zinc-100`;
  }
  if (message.status === 'error') {
    return `${BUBBLE_BASE} self-start bg-red-950/30 border border-red-900/50 text-red-200`;
  }
  return `${BUBBLE_BASE} self-start bg-[#131420] border border-[#22243a] text-zinc-300`;
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function AgentStatusIcon({ status }: { status: AgentProgress['status'] }) {
  if (status === 'done') return <Check className="h-3 w-3 text-emerald-400" aria-hidden />;
  if (status === 'error') return <AlertTriangle className="h-3 w-3 text-red-400" aria-hidden />;
  if (status === 'running') return <Loader2 className="h-3 w-3 animate-spin text-amber-400" aria-hidden />;
  return <Clock className="h-3 w-3 text-zinc-500" aria-hidden />;
}

/** One row per parallel agent: status, what it builds, and how long it took or why it failed */
function AgentRows({ agents }: { agents: AgentProgress[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1 border-t border-white/5 pt-2 whitespace-normal">
      {agents.map((agent, index) => (
        <li key={index} data-agent-status={agent.status} className="flex items-start gap-1.5 text-[11px]">
          <span className="mt-0.5 flex-shrink-0">
            <AgentStatusIcon status={agent.status} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={agent.status === 'queued' ? 'text-zinc-500' : 'text-zinc-200'}>{agent.label}</span>
            {agent.error && <span className="block text-red-300/90">{agent.error}</span>}
          </span>
          {agent.durationMs !== undefined && (
            <span className="flex-shrink-0 font-mono text-zinc-500">{formatDuration(agent.durationMs)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Conversation of the active agent session, scrolled to the newest message */
export const ChatTranscript: React.FC<ChatTranscriptProps> = ({ messages }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];

  // Follow new messages, replies that settle and agent rows that change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.status, last?.text, last?.agents]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2"
      role="log"
      aria-label="Agent chat history"
      aria-live="polite"
    >
      {messages.map((message) => (
        <div key={message.id} className={bubbleClass(message)}>
          {message.role === 'assistant' && message.status === 'pending' && (
            <Loader2 className="inline h-3 w-3 mr-1.5 -mt-0.5 animate-spin text-orange-400" aria-hidden />
          )}
          {message.text}
          {message.agents && message.agents.length > 0 && <AgentRows agents={message.agents} />}
        </div>
      ))}
    </div>
  );
};
