import type { AgentProgress, ChatMessagePatch, NewChatMessage } from './agent-chat';

export interface GenerationResult {
  ok: boolean;
  /** What happened, shown as the agent's reply */
  message: string;
  /** Final state of each parallel agent, when the run got that far */
  agents?: AgentProgress[];
}

export interface GenerationProgress {
  text: string;
  agents: AgentProgress[];
}

/** Called while generation runs, to keep the pending reply up to date */
export type ProgressReporter = (progress: GenerationProgress) => void;

export interface AgentTurnChat {
  ensureActiveSession: () => string;
  addMessage: (sessionId: string, message: NewChatMessage) => string | null;
  updateMessage: (sessionId: string, messageId: string, patch: ChatMessagePatch) => void;
}

export interface AgentTurnDeps {
  chat: AgentTurnChat;
  generate: (prompt: string, model: string, onProgress?: ProgressReporter) => Promise<GenerationResult>;
  openAdvisor: () => void;
}

export const PENDING_REPLY = 'Đang sinh thiết kế…';
export const ADVISOR_REPLY = 'Đã mở Advisor để audit/critique thiết kế.';

/** Audit and critique requests belong to the Advisor drawer, not to design generation */
export function isAdvisorRequest(prompt: string): boolean {
  const text = prompt.toLowerCase();
  return text.includes('audit') || text.includes('critique');
}

function errorText(error: unknown): string {
  return `❌ Lỗi khi sinh thiết kế: ${error instanceof Error ? error.message : 'không rõ nguyên nhân'}`;
}

/**
 * One chat turn: records the prompt in the active session, runs it, and always
 * settles the agent's reply, even when generation throws. Resolves true when
 * the prompt was handled, so the input box can clear.
 */
export async function runAgentTurn(prompt: string, model: string, deps: AgentTurnDeps): Promise<boolean> {
  const { chat } = deps;
  // Captured before any await, so switching chats mid-generation cannot redirect the reply
  const sessionId = chat.ensureActiveSession();
  chat.addMessage(sessionId, { role: 'user', text: prompt, status: 'done' });

  if (isAdvisorRequest(prompt)) {
    deps.openAdvisor();
    chat.addMessage(sessionId, { role: 'assistant', text: ADVISOR_REPLY, status: 'done' });
    return true;
  }

  const replyId = chat.addMessage(sessionId, { role: 'assistant', text: PENDING_REPLY, status: 'pending' });
  const settle = (patch: ChatMessagePatch) => {
    if (replyId) chat.updateMessage(sessionId, replyId, patch);
  };
  try {
    const result = await deps.generate(prompt, model, ({ text, agents }) => settle({ text, agents }));
    settle({
      text: result.message,
      status: result.ok ? 'done' : 'error',
      ...(result.agents ? { agents: result.agents } : {}),
    });
    return result.ok;
  } catch (error) {
    settle({ text: errorText(error), status: 'error' });
    return false;
  }
}
