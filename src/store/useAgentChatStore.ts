import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';
import {
  AgentChatState,
  ChatMessagePatch,
  EMPTY_CHAT_STATE,
  NewChatMessage,
  addSession,
  appendMessage,
  createSession,
  findEmptySession,
  patchMessage,
  removeSession,
  restoreChatState,
} from '../lib/agent-chat';

/** Unique key: AdvisorDrawer and AgentConnectModal keep their own localStorage entries */
export const AGENT_CHAT_STORAGE_KEY = 'pen-studio.agent-chat';

export interface AgentChatStore extends AgentChatState {
  /** Starts a chat and makes it active; an existing chat with no messages is reused */
  newSession: () => string;
  /** Active chat id, creating one when there is none */
  ensureActiveSession: () => string;
  selectSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  /** Adds a message and returns its id, or null when the chat was deleted */
  addMessage: (sessionId: string, message: NewChatMessage) => string | null;
  updateMessage: (sessionId: string, messageId: string, patch: ChatMessagePatch) => void;
}

const newId = () => crypto.randomUUID();

/**
 * localStorage wrapper that never throws: a full quota or blocked storage
 * loses history persistence, not the chat itself.
 */
const safeLocalStorage: PersistStorage<AgentChatState> = {
  getItem: (name) => {
    try {
      const raw = globalThis.localStorage?.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<AgentChatState>) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled: keep the in-memory history
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // Storage disabled
    }
  },
};

export const useAgentChatStore = create<AgentChatStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_CHAT_STATE,

      newSession: () => {
        const { sessions } = get();
        const empty = findEmptySession(sessions);
        if (empty) {
          set({ activeSessionId: empty.id });
          return empty.id;
        }
        const session = createSession(newId(), Date.now());
        set({ sessions: addSession(sessions, session), activeSessionId: session.id });
        return session.id;
      },

      ensureActiveSession: () => {
        const { sessions, activeSessionId } = get();
        if (activeSessionId && sessions.some((s) => s.id === activeSessionId)) return activeSessionId;
        return get().newSession();
      },

      selectSession: (sessionId) => {
        if (get().sessions.some((s) => s.id === sessionId)) set({ activeSessionId: sessionId });
      },

      deleteSession: (sessionId) => {
        const { sessions, activeSessionId } = get();
        const remaining = removeSession(sessions, sessionId);
        set({
          sessions: remaining,
          activeSessionId: activeSessionId === sessionId ? remaining[0]?.id ?? null : activeSessionId,
        });
      },

      addMessage: (sessionId, message) => {
        const { sessions } = get();
        if (!sessions.some((s) => s.id === sessionId)) return null;
        const id = newId();
        set({ sessions: appendMessage(sessions, sessionId, { ...message, id, createdAt: Date.now() }) });
        return id;
      },

      updateMessage: (sessionId, messageId, patch) => {
        set({ sessions: patchMessage(get().sessions, sessionId, messageId, patch) });
      },
    }),
    {
      name: AGENT_CHAT_STORAGE_KEY,
      version: 1,
      storage: safeLocalStorage,
      partialize: ({ sessions, activeSessionId }) => ({ sessions, activeSessionId }),
      // Stored data is untrusted: validate it, falling back to an empty history
      merge: (persisted, current) => ({ ...current, ...restoreChatState(persisted) }),
    }
  )
);
