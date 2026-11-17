import { z } from 'zod';

export type ChatRole = 'user' | 'assistant';
export type ChatStatus = 'pending' | 'done' | 'error';

export type AgentStatus = 'queued' | 'running' | 'done' | 'error';

/** One parallel agent's line under a generation reply */
export interface AgentProgress {
  label: string;
  status: AgentStatus;
  durationMs?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  status: ChatStatus;
  createdAt: number;
  /** Present on replies of a generation run */
  agents?: AgentProgress[];
}

export interface AgentSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentChatState {
  sessions: AgentSession[];
  activeSessionId: string | null;
}

export type NewChatMessage = Pick<ChatMessage, 'role' | 'text' | 'status'>;
export type ChatMessagePatch = Partial<Pick<ChatMessage, 'text' | 'status' | 'agents'>>;

export const DEFAULT_SESSION_TITLE = 'New Agent';
/** Oldest sessions are dropped beyond this, so localStorage stays small */
export const MAX_SESSIONS = 30;
export const MAX_MESSAGES_PER_SESSION = 200;
/** Pasted prompts can be huge; history keeps the start of each message */
export const MAX_MESSAGE_LENGTH = 8000;
const MAX_TITLE_LENGTH = 48;
export const INTERRUPTED_REPLY = 'Bị gián đoạn khi tải lại trang.';
/** Parallel agents go up to 6; anything far beyond that is corrupt storage */
const MAX_AGENTS_PER_MESSAGE = 24;

export const EMPTY_CHAT_STATE: AgentChatState = { sessions: [], activeSessionId: null };

export function createSession(id: string, now: number): AgentSession {
  return { id, title: DEFAULT_SESSION_TITLE, messages: [], createdAt: now, updatedAt: now };
}

/** Session title from the first prompt: one line, cut at a word where possible */
export function titleFromPrompt(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  if (!line) return DEFAULT_SESSION_TITLE;
  if (line.length <= MAX_TITLE_LENGTH) return line;
  const cut = line.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${lastSpace > MAX_TITLE_LENGTH / 2 ? cut.slice(0, lastSpace) : cut}…`;
}

function clampText(text: string): string {
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

/** `sessions` with `session` first, keeping only the most recently used MAX_SESSIONS */
export function addSession(sessions: AgentSession[], session: AgentSession): AgentSession[] {
  return [session, ...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
}

export function removeSession(sessions: AgentSession[], sessionId: string): AgentSession[] {
  return sessions.filter((session) => session.id !== sessionId);
}

/** Appends a message; the first user message names an untitled session, and the session moves to the top */
export function appendMessage(
  sessions: AgentSession[],
  sessionId: string,
  message: ChatMessage
): AgentSession[] {
  const updated = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const isFirstPrompt = message.role === 'user' && !session.messages.some((m) => m.role === 'user');
    return {
      ...session,
      title: isFirstPrompt ? titleFromPrompt(message.text) : session.title,
      messages: [...session.messages, { ...message, text: clampText(message.text) }].slice(-MAX_MESSAGES_PER_SESSION),
      updatedAt: message.createdAt,
    };
  });
  return updated.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Updates one message; unchanged when the session or message no longer exists */
export function patchMessage(
  sessions: AgentSession[],
  sessionId: string,
  messageId: string,
  patch: ChatMessagePatch
): AgentSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId || !session.messages.some((m) => m.id === messageId)) return session;
    const next = patch.text === undefined ? patch : { ...patch, text: clampText(patch.text) };
    return {
      ...session,
      messages: session.messages.map((m) => (m.id === messageId ? { ...m, ...next } : m)),
    };
  });
}

/** A chat with no messages yet, which "New" reuses instead of adding another */
export function findEmptySession(sessions: AgentSession[]): AgentSession | undefined {
  return sessions.find((session) => session.messages.length === 0);
}

const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
  status: z.enum(['pending', 'done', 'error']),
  createdAt: z.number(),
  agents: z
    .array(
      z.object({
        label: z.string(),
        status: z.enum(['queued', 'running', 'done', 'error']),
        durationMs: z.number().optional(),
        error: z.string().optional(),
      })
    )
    .max(MAX_AGENTS_PER_MESSAGE)
    .optional(),
});

/** A reply cut off by a reload: agents that never finished are shown as failed */
function interrupted(message: ChatMessage): ChatMessage {
  const agents = message.agents?.map((agent) =>
    agent.status === 'done' || agent.status === 'error' ? agent : { ...agent, status: 'error' as const }
  );
  return { ...message, status: 'error', text: INTERRUPTED_REPLY, ...(agents ? { agents } : {}) };
}

const agentSessionSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  messages: z.array(chatMessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const agentChatStateSchema = z.object({
  sessions: z.array(agentSessionSchema),
  activeSessionId: z.string().nullable(),
});

/**
 * Chat history read back from storage. Invalid data yields the empty state, and
 * replies still pending when the page closed are marked as interrupted.
 */
export function restoreChatState(persisted: unknown): AgentChatState {
  const parsed = agentChatStateSchema.safeParse(persisted);
  if (!parsed.success) return EMPTY_CHAT_STATE;
  const sessions = parsed.data.sessions.slice(0, MAX_SESSIONS).map((session) => ({
    ...session,
    messages: session.messages
      .slice(-MAX_MESSAGES_PER_SESSION)
      .map((m) => (m.status === 'pending' ? interrupted(m) : m)),
  }));
  const { activeSessionId } = parsed.data;
  return {
    sessions,
    activeSessionId: sessions.some((s) => s.id === activeSessionId) ? activeSessionId : null,
  };
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Short age label for the session list: "vừa xong", "5 phút trước", "3 giờ trước", or a date */
export function formatSessionAge(timestamp: number, now: number): string {
  const age = Math.max(0, now - timestamp);
  if (age < MINUTE_MS) return 'vừa xong';
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)} phút trước`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)} giờ trước`;
  return new Date(timestamp).toLocaleDateString('vi-VN');
}
