import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useAgentChatStore } from '../../store/useAgentChatStore';
import { DEFAULT_SESSION_TITLE, formatSessionAge } from '../../lib/agent-chat';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

/** Dropdown naming the active agent chat; lists saved chats to switch to or delete */
export const AgentSessionMenu: React.FC = () => {
  const sessions = useAgentChatStore((state) => state.sessions);
  const activeSessionId = useAgentChatStore((state) => state.activeSessionId);
  const { newSession, selectSession, deleteSession } = useAgentChatStore.getState();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = () => setIsOpen(false);
  useEscapeToClose(isOpen, close);

  // Clicks outside the menu close it
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const active = sessions.find((session) => session.id === activeSessionId);
  const now = Date.now();

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 max-w-[11rem] px-2 py-1 rounded bg-[#161722] hover:bg-[#1e202f] border border-[#27293a] text-xs font-medium text-zinc-200 transition"
        title="Lịch sử chat với agent"
      >
        <span className="truncate">{active?.title ?? DEFAULT_SESSION_TITLE}</span>
        <ChevronDown className={`h-3 w-3 flex-shrink-0 text-zinc-500 transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1.5 z-30 w-64 max-h-80 overflow-y-auto rounded-xl bg-[#141520] border border-[#2a2c40] shadow-2xl py-1"
        >
          <button
            role="menuitem"
            onClick={() => {
              newSession();
              close();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-orange-300 hover:bg-[#1e2030] transition"
          >
            <Plus className="h-3.5 w-3.5" />
            New Agent
          </button>
          {sessions.length > 0 && <div className="my-1 border-t border-[#22243a]" />}
          {sessions.length === 0 && <p className="px-3 py-2 text-[11px] text-zinc-500">Chưa có lịch sử chat.</p>}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-1.5 transition ${
                session.id === activeSessionId ? 'bg-[#1c1e2e]' : 'hover:bg-[#1a1b28]'
              }`}
            >
              <button
                role="menuitem"
                onClick={() => {
                  selectSession(session.id);
                  close();
                }}
                className="flex flex-1 min-w-0 items-center gap-2 text-left"
              >
                <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-zinc-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-zinc-200">{session.title}</span>
                  <span className="block text-[10px] text-zinc-500">
                    {session.messages.length} tin nhắn · {formatSessionAge(session.updatedAt, now)}
                  </span>
                </span>
              </button>
              <button
                onClick={() => deleteSession(session.id)}
                className="p-1 rounded text-zinc-600 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-red-400 hover:bg-red-950/40 transition"
                title="Xoá đoạn chat"
                aria-label={`Xoá đoạn chat ${session.title}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
