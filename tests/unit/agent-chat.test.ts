import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentSession,
  ChatMessage,
  DEFAULT_SESSION_TITLE,
  INTERRUPTED_REPLY,
  MAX_MESSAGES_PER_SESSION,
  MAX_MESSAGE_LENGTH,
  MAX_SESSIONS,
  addSession,
  appendMessage,
  createSession,
  formatSessionAge,
  patchMessage,
  restoreChatState,
  titleFromPrompt,
} from '../../src/lib/agent-chat';
import { ADVISOR_REPLY, AgentTurnChat, GenerationResult, PENDING_REPLY, runAgentTurn } from '../../src/lib/agent-turn';
import { useAgentChatStore } from '../../src/store/useAgentChatStore';

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return { id: 'm1', role: 'user', text: 'hello', status: 'done', createdAt: 100, ...overrides };
}

describe('titleFromPrompt', () => {
  it('collapses whitespace into one line', () => {
    expect(titleFromPrompt('  Landing\n page   for  cafe ')).toBe('Landing page for cafe');
  });

  it('falls back to the default title for blank prompts', () => {
    expect(titleFromPrompt('   ')).toBe(DEFAULT_SESSION_TITLE);
  });

  it('cuts long prompts at a word boundary', () => {
    const title = titleFromPrompt('Warm minimal booking site for a Lisbon ceramic studio with gallery');
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(49);
    expect(title).not.toMatch(/\s…$/);
  });
});

describe('appendMessage', () => {
  it('names the session from the first user prompt only', () => {
    let sessions = [createSession('s1', 0)];
    sessions = appendMessage(sessions, 's1', message({ text: 'First prompt' }));
    sessions = appendMessage(sessions, 's1', message({ id: 'm2', text: 'Second prompt' }));
    expect(sessions[0].title).toBe('First prompt');
    expect(sessions[0].messages).toHaveLength(2);
    expect(sessions[0].updatedAt).toBe(100);
  });

  it('clamps very long text', () => {
    const sessions = appendMessage([createSession('s1', 0)], 's1', message({ text: 'x'.repeat(MAX_MESSAGE_LENGTH + 50) }));
    expect(sessions[0].messages[0].text).toHaveLength(MAX_MESSAGE_LENGTH + 1);
  });

  it('keeps only the newest messages', () => {
    let sessions = [createSession('s1', 0)];
    for (let i = 0; i < MAX_MESSAGES_PER_SESSION + 5; i++) {
      sessions = appendMessage(sessions, 's1', message({ id: `m${i}`, role: 'assistant' }));
    }
    expect(sessions[0].messages).toHaveLength(MAX_MESSAGES_PER_SESSION);
    expect(sessions[0].messages[0].id).toBe('m5');
  });

  it('moves the updated session to the top', () => {
    const sessions = [createSession('new', 50), createSession('old', 10)];
    expect(appendMessage(sessions, 'old', message()).map((s) => s.id)).toEqual(['old', 'new']);
  });

  it('does not mutate the input', () => {
    const original = [createSession('s1', 0)];
    appendMessage(original, 's1', message());
    expect(original[0].messages).toHaveLength(0);
  });
});

describe('patchMessage', () => {
  it('updates the matching message', () => {
    const sessions = appendMessage([createSession('s1', 0)], 's1', message({ role: 'assistant', status: 'pending' }));
    const patched = patchMessage(sessions, 's1', 'm1', { text: 'done', status: 'done' });
    expect(patched[0].messages[0]).toMatchObject({ text: 'done', status: 'done' });
  });

  it('leaves sessions unchanged when the message is gone', () => {
    const sessions = [createSession('s1', 0)];
    expect(patchMessage(sessions, 's1', 'missing', { text: 'x' })[0]).toBe(sessions[0]);
  });
});

describe('addSession', () => {
  it('keeps only the most recently used sessions', () => {
    let sessions: AgentSession[] = [];
    for (let i = 0; i < MAX_SESSIONS + 3; i++) sessions = addSession(sessions, createSession(`s${i}`, i));
    expect(sessions).toHaveLength(MAX_SESSIONS);
    expect(sessions[0].id).toBe(`s${MAX_SESSIONS + 2}`);
  });
});

describe('restoreChatState', () => {
  it('returns an empty history for invalid data', () => {
    expect(restoreChatState({ sessions: 'nope' })).toEqual({ sessions: [], activeSessionId: null });
    expect(restoreChatState(null)).toEqual({ sessions: [], activeSessionId: null });
  });

  it('marks replies pending at reload as interrupted', () => {
    const session = { ...createSession('s1', 0), messages: [message({ role: 'assistant', status: 'pending' })] };
    const restored = restoreChatState({ sessions: [session], activeSessionId: 's1' });
    expect(restored.sessions[0].messages[0]).toMatchObject({ status: 'error', text: INTERRUPTED_REPLY });
    expect(restored.activeSessionId).toBe('s1');
  });

  it('drops an active id that names no session', () => {
    expect(restoreChatState({ sessions: [createSession('s1', 0)], activeSessionId: 'gone' }).activeSessionId).toBeNull();
  });
});

describe('formatSessionAge', () => {
  const now = 10 * 24 * 3_600_000;
  it('labels recent ages relatively', () => {
    expect(formatSessionAge(now - 5_000, now)).toBe('vừa xong');
    expect(formatSessionAge(now - 5 * 60_000, now)).toBe('5 phút trước');
    expect(formatSessionAge(now - 3 * 3_600_000, now)).toBe('3 giờ trước');
  });

  it('shows a date for older sessions', () => {
    expect(formatSessionAge(now - 3 * 24 * 3_600_000, now)).not.toMatch(/trước/);
  });
});

function resetChat() {
  useAgentChatStore.setState({ sessions: [], activeSessionId: null });
}

describe('useAgentChatStore', () => {
  beforeEach(resetChat);

  it('reuses the active chat when it is still empty', () => {
    const { newSession } = useAgentChatStore.getState();
    const first = newSession();
    expect(newSession()).toBe(first);
    expect(useAgentChatStore.getState().sessions).toHaveLength(1);
  });

  it('starts a new chat once the active one has messages', () => {
    const store = useAgentChatStore.getState();
    const first = store.newSession();
    store.addMessage(first, { role: 'user', text: 'hi', status: 'done' });
    const second = store.newSession();
    expect(second).not.toBe(first);
    expect(useAgentChatStore.getState().activeSessionId).toBe(second);
  });

  it('reuses an empty chat that is not active', () => {
    const store = useAgentChatStore.getState();
    const older = store.newSession();
    store.addMessage(older, { role: 'user', text: 'hi', status: 'done' });
    const empty = store.newSession();
    store.selectSession(older);
    expect(store.newSession()).toBe(empty);
    expect(useAgentChatStore.getState().sessions).toHaveLength(2);
  });

  it('selects another chat when the active one is deleted', () => {
    const store = useAgentChatStore.getState();
    const first = store.newSession();
    store.addMessage(first, { role: 'user', text: 'hi', status: 'done' });
    const second = store.newSession();
    store.deleteSession(second);
    expect(useAgentChatStore.getState().activeSessionId).toBe(first);
  });

  it('refuses messages for a deleted chat', () => {
    const store = useAgentChatStore.getState();
    const id = store.newSession();
    store.deleteSession(id);
    expect(store.addMessage(id, { role: 'user', text: 'hi', status: 'done' })).toBeNull();
  });
});

describe('runAgentTurn', () => {
  beforeEach(resetChat);

  const chat = (): AgentTurnChat => useAgentChatStore.getState();
  const activeMessages = () => {
    const { sessions, activeSessionId } = useAgentChatStore.getState();
    return sessions.find((s) => s.id === activeSessionId)?.messages ?? [];
  };
  const deps = (generate: (prompt: string, model: string) => Promise<GenerationResult>) => ({
    chat: chat(),
    generate,
    openAdvisor: () => {},
  });

  it('records the prompt and the successful reply', async () => {
    const handled = await runAgentTurn('Cafe site', 'Opus', deps(async () => ({ ok: true, message: '✨ Done' })));
    expect(handled).toBe(true);
    expect(activeMessages().map((m) => [m.role, m.text, m.status])).toEqual([
      ['user', 'Cafe site', 'done'],
      ['assistant', '✨ Done', 'done'],
    ]);
  });

  it('shows a pending reply while generating', async () => {
    let resolve: (r: GenerationResult) => void = () => {};
    const turn = runAgentTurn('Cafe', 'Opus', deps(() => new Promise((r) => (resolve = r))));
    expect(activeMessages()[1]).toMatchObject({ text: PENDING_REPLY, status: 'pending' });
    resolve({ ok: true, message: 'ok' });
    await turn;
    expect(activeMessages()[1].status).toBe('done');
  });

  it('marks a failed generation as an error', async () => {
    const handled = await runAgentTurn('Cafe', 'Opus', deps(async () => ({ ok: false, message: '❌ nope' })));
    expect(handled).toBe(false);
    expect(activeMessages()[1]).toMatchObject({ text: '❌ nope', status: 'error' });
  });

  it('settles the reply when generation throws', async () => {
    const handled = await runAgentTurn('Cafe', 'Opus', deps(async () => { throw new Error('boom'); }));
    expect(handled).toBe(false);
    expect(activeMessages()[1].status).toBe('error');
    expect(activeMessages()[1].text).toContain('boom');
  });

  it('keeps the reply in the original chat after switching chats', async () => {
    let resolve: (r: GenerationResult) => void = () => {};
    const turn = runAgentTurn('Cafe', 'Opus', deps(() => new Promise((r) => (resolve = r))));
    const original = useAgentChatStore.getState().activeSessionId;
    useAgentChatStore.getState().newSession();
    resolve({ ok: true, message: 'ok' });
    await turn;
    const session = useAgentChatStore.getState().sessions.find((s) => s.id === original);
    expect(session?.messages[1]).toMatchObject({ text: 'ok', status: 'done' });
    expect(activeMessages()).toHaveLength(0);
  });

  it('ignores the reply when its chat was deleted mid-generation', async () => {
    let resolve: (r: GenerationResult) => void = () => {};
    const turn = runAgentTurn('Cafe', 'Opus', deps(() => new Promise((r) => (resolve = r))));
    useAgentChatStore.getState().deleteSession(useAgentChatStore.getState().activeSessionId!);
    resolve({ ok: true, message: 'ok' });
    await expect(turn).resolves.toBe(true);
    expect(useAgentChatStore.getState().sessions).toHaveLength(0);
  });

  it('opens the Advisor for audit requests without generating', async () => {
    let opened = false;
    let generated = false;
    const handled = await runAgentTurn('Audit this screen', 'Opus', {
      chat: chat(),
      generate: async () => {
        generated = true;
        return { ok: true, message: '' };
      },
      openAdvisor: () => (opened = true),
    });
    expect(handled).toBe(true);
    expect(opened).toBe(true);
    expect(generated).toBe(false);
    expect(activeMessages()[1].text).toBe(ADVISOR_REPLY);
  });
});
