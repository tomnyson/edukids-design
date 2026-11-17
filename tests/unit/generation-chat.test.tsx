import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentProgress, ChatMessage, INTERRUPTED_REPLY, patchMessage, restoreChatState } from '../../src/lib/agent-chat';
import { GenerationResult, ProgressReporter, runAgentTurn } from '../../src/lib/agent-turn';
import { useAgentChatStore } from '../../src/store/useAgentChatStore';
import { ChatTranscript } from '../../src/components/sidebar/ChatTranscript';
import { GenerationPlaceholder } from '../../src/components/canvas/GenerationRunLayer';

const AGENTS: AgentProgress[] = [
  { label: 'Agent 1 · Hero', status: 'done', durationMs: 42_300 },
  { label: 'Agent 2 · Pricing', status: 'running' },
  { label: 'Agent 3 · Footer', status: 'error', durationMs: 1000, error: 'rate limited' },
];

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({
  id: 'm1',
  role: 'assistant',
  text: 'reply',
  status: 'done',
  createdAt: 1,
  ...overrides,
});
const stored = (messages: ChatMessage[]) => ({
  sessions: [{ id: 's1', title: 'T', messages, createdAt: 1, updatedAt: 1 }],
  activeSessionId: 's1',
});

describe('chat history with agent progress', () => {
  it('restores messages with and without agents', () => {
    const restored = restoreChatState(stored([message({ id: 'a' }), message({ id: 'b', agents: AGENTS.slice(0, 1) })]));
    expect(restored.sessions[0].messages[0].agents).toBeUndefined();
    expect(restored.sessions[0].messages[1].agents).toEqual(AGENTS.slice(0, 1));
  });

  it('rejects a malformed agents list', () => {
    const bad = stored([message({ agents: [{ label: 1, status: 'nope' }] as unknown as AgentProgress[] })]);
    expect(restoreChatState(bad).sessions).toEqual([]);
  });

  it('marks unfinished agents of an interrupted reply as failed', () => {
    const restored = restoreChatState(stored([message({ status: 'pending', agents: AGENTS })]));
    const reply = restored.sessions[0].messages[0];
    expect(reply).toMatchObject({ status: 'error', text: INTERRUPTED_REPLY });
    expect(reply.agents?.map((a) => a.status)).toEqual(['done', 'error', 'error']);
  });

  it('patches agents onto a message', () => {
    const sessions = patchMessage(stored([message({})]).sessions, 's1', 'm1', { agents: AGENTS });
    expect(sessions[0].messages[0].agents).toEqual(AGENTS);
  });
});

describe('runAgentTurn progress', () => {
  beforeEach(() => {
    useAgentChatStore.setState({ sessions: [], activeSessionId: null });
  });
  const reply = () => {
    const { sessions, activeSessionId } = useAgentChatStore.getState();
    return sessions.find((s) => s.id === activeSessionId)?.messages[1];
  };

  it('shows progress on the pending reply, then settles with the final agents', async () => {
    let report: ProgressReporter = () => {};
    let resolve: (result: GenerationResult) => void = () => {};
    const turn = runAgentTurn('Cafe', 'Opus', {
      chat: useAgentChatStore.getState(),
      generate: (_prompt, _model, onProgress) => {
        report = onProgress ?? report;
        return new Promise((r) => (resolve = r));
      },
      openAdvisor: () => {},
    });

    report({ text: 'Đang sinh 1/3', agents: AGENTS });
    expect(reply()).toMatchObject({ text: 'Đang sinh 1/3', status: 'pending', agents: AGENTS });

    const finalAgents = AGENTS.map((a) => ({ ...a, status: 'done' as const }));
    resolve({ ok: true, message: '✨ Done', agents: finalAgents });
    await turn;
    expect(reply()).toMatchObject({ text: '✨ Done', status: 'done', agents: finalAgents });
  });
});

describe('ChatTranscript agent rows', () => {
  it('lists each agent with its label, duration and error', () => {
    const html = renderToStaticMarkup(<ChatTranscript messages={[message({ status: 'pending', agents: AGENTS })]} />);
    expect(html).toContain('Agent 1 · Hero');
    expect(html).toContain('42s');
    expect(html).toContain('Agent 2 · Pricing');
    expect(html).toContain('rate limited');
    expect(html.match(/data-agent-status="/g)).toHaveLength(3);
  });

  it('renders plain messages without an agent list', () => {
    const html = renderToStaticMarkup(<ChatTranscript messages={[message({})]} />);
    expect(html).not.toContain('data-agent-status');
  });
});

describe('GenerationPlaceholder', () => {
  const slot = { id: 's', index: 1, label: 'Pricing', status: 'running' as const, width: 1280, height: 600 };

  it('shows the agent label at the slot size and position', () => {
    const html = renderToStaticMarkup(<GenerationPlaceholder slot={slot} x={100} y={850} />);
    expect(html).toContain('Agent 2 · Pricing');
    expect(html).toContain('left:100px');
    expect(html).toContain('top:850px');
    expect(html).toContain('width:1280px');
    expect(html).toContain('height:600px');
  });

  it('shows the error of a failed slot', () => {
    const html = renderToStaticMarkup(
      <GenerationPlaceholder slot={{ ...slot, status: 'error', error: 'rate limited' }} x={0} y={0} />
    );
    expect(html).toContain('rate limited');
  });
});
