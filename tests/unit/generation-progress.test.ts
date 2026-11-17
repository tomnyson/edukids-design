import { describe, it, expect, beforeEach } from 'vitest';
import {
  DESIGN_TOOL_NAME,
  DesignMessage,
  DesignRequest,
  GenerationEvent,
  buildDesignRequest,
  generateDesigns,
  variantLabel,
} from '../../src/generator/design-generator';
import { PLAN_TOOL_NAME, fallbackPlan } from '../../src/generator/page-plan';
import { parseCliResult } from '../../server/claude-cli';
import { useDesignStore } from '../../src/store/useDesignStore';
import { useGenerationStore } from '../../src/store/useGenerationStore';
import { createRun } from '../../src/lib/generation-run';
import { FrameNode } from '../../src/types/pen-ast';

const DESIGN = { type: 'frame', name: 'Section', x: 0, y: 0, width: 1280, height: 500, children: [] };
const designMessage = (name = 'Section'): DesignMessage => ({
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', name: DESIGN_TOOL_NAME, input: { design: { ...DESIGN, name } } }],
});

const PLAN = {
  width: 1440,
  palette: { background: '#0b0c10', surface: '#15171f', text: '#f5f5f5', mutedText: '#9aa0aa', accent: '#22d3ee' },
  fonts: { heading: 'Space Grotesk', body: 'Inter' },
  styleNotes: 'Dense and technical.',
  sections: [
    { name: 'Fleet header', brief: 'Summary numbers', estimatedHeight: 300 },
    { name: 'Robot grid', brief: 'Status cards', estimatedHeight: 900 },
  ],
};
const planMessage: DesignMessage = {
  stop_reason: 'tool_use',
  content: [{ type: 'tool_use', name: PLAN_TOOL_NAME, input: PLAN }],
};
const isPlanRequest = (request: DesignRequest) => request.tool_choice.name === PLAN_TOOL_NAME;
const base = { prompt: 'Robot fleet dashboard', attachments: [], modelId: 'm' };

describe('buildDesignRequest with a page plan', () => {
  const text = JSON.stringify(
    buildDesignRequest({ ...base, variantIndex: 1, variantCount: 2, mode: 'split', plan: PLAN }).messages
  );

  it('briefs the agent with its own section and the whole outline', () => {
    expect(text).toContain('section 2 of 2');
    expect(text).toContain('Robot grid');
    expect(text).toContain('Status cards');
    expect(text).toContain('Fleet header');
  });

  it('pins the shared width, palette and fonts', () => {
    expect(text).toContain('1440');
    expect(text).toContain('#22d3ee');
    expect(text).toContain('#0b0c10');
    expect(text).toContain('Space Grotesk');
    expect(text).toContain('Dense and technical.');
  });

  it('uses the fallback plan when none is given', () => {
    const fallbackText = JSON.stringify(
      buildDesignRequest({ ...base, variantIndex: 0, variantCount: 2, mode: 'split' }).messages
    );
    expect(fallbackText).toContain(fallbackPlan(2).sections[0].name);
    expect(fallbackText).toContain(fallbackPlan(2).palette.accent);
  });
});

describe('variantLabel', () => {
  it('names side-by-side variants after their art direction', () => {
    expect(variantLabel(0)).toBe('Editorial');
    expect(variantLabel(1)).toBe('Dark luxury');
  });
});

describe('generateDesigns progress', () => {
  it('plans first in split mode, then reports every agent', async () => {
    const events: GenerationEvent[] = [];
    const result = await generateDesigns({
      ...base,
      count: 2,
      mode: 'split',
      createMessage: async (request) => {
        if (isPlanRequest(request)) return planMessage;
        const second = JSON.stringify(request.messages).includes('section 2 of 2');
        await new Promise((r) => setTimeout(r, second ? 0 : 15));
        return designMessage(second ? 'second' : 'first');
      },
      onProgress: (event) => events.push(event),
    });

    expect(events.map((e) => e.type).slice(0, 2)).toEqual(['plan-started', 'plan-ready']);
    const ready = events[1];
    expect(ready.type === 'plan-ready' && ready.usedFallback).toBe(false);
    expect(ready.type === 'plan-ready' && ready.plan.sections[1].name).toBe('Robot grid');
    // Agents start together, and the faster second agent reports first
    expect(events.slice(2).map((e) => (e.type === 'plan-started' || e.type === 'plan-ready' ? e.type : `${e.type}:${e.index}`))).toEqual([
      'agent-started:0',
      'agent-started:1',
      'agent-done:1',
      'agent-done:0',
    ]);
    expect(result.designs.map((d) => d.name)).toEqual(['first', 'second']);
  });

  it('reports the fallback and still generates when planning fails', async () => {
    const events: GenerationEvent[] = [];
    const result = await generateDesigns({
      ...base,
      count: 2,
      mode: 'split',
      createMessage: async (request) => {
        if (isPlanRequest(request)) throw new Error('planner down');
        return designMessage();
      },
      onProgress: (event) => events.push(event),
    });
    const ready = events.find((e) => e.type === 'plan-ready');
    expect(ready?.type === 'plan-ready' && ready.usedFallback).toBe(true);
    expect(result.designs).toHaveLength(2);
    expect(result.errors).toEqual([]);
  });

  it('does not plan for side-by-side or a single agent', async () => {
    const requests: DesignRequest[] = [];
    const events: GenerationEvent[] = [];
    const createMessage = async (request: DesignRequest) => {
      requests.push(request);
      return designMessage();
    };
    await generateDesigns({ ...base, count: 2, mode: 'side-by-side', createMessage, onProgress: (e) => events.push(e) });
    await generateDesigns({ ...base, count: 1, mode: 'split', createMessage });
    expect(requests.some(isPlanRequest)).toBe(false);
    expect(events.some((e) => e.type === 'plan-started')).toBe(false);
  });

  it('reports a failed agent without hiding the others', async () => {
    const events: GenerationEvent[] = [];
    let call = 0;
    const result = await generateDesigns({
      ...base,
      count: 2,
      mode: 'side-by-side',
      createMessage: async () => {
        if (++call === 1) throw new Error('rate limited');
        return designMessage();
      },
      onProgress: (event) => events.push(event),
    });
    expect(events).toContainEqual({ type: 'agent-failed', index: 0, error: 'rate limited' });
    expect(events.some((e) => e.type === 'agent-done' && e.index === 1)).toBe(true);
    expect(result.designs).toHaveLength(1);
  });

  it('keeps generating when the progress listener throws', async () => {
    const result = await generateDesigns({
      ...base,
      count: 1,
      mode: 'side-by-side',
      createMessage: async () => designMessage(),
      onProgress: () => {
        throw new Error('listener bug');
      },
    });
    expect(result.designs).toHaveLength(1);
  });
});

describe('parseCliResult tool name', () => {
  it('returns the requested tool name', () => {
    const stdout = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, structured_output: PLAN });
    expect(parseCliResult(stdout, '', PLAN_TOOL_NAME).content[0]).toMatchObject({ name: PLAN_TOOL_NAME, input: PLAN });
    expect(parseCliResult(stdout, '').content[0].name).toBe(DESIGN_TOOL_NAME);
  });
});

describe('generation run store', () => {
  const frame = (name: string, x: number, y: number): FrameNode => ({
    id: `gen-${name}`,
    type: 'frame',
    name,
    x,
    y,
    width: 400,
    height: 300,
    children: [],
  });
  const run = () =>
    createRun({
      id: 'run1',
      tabId: useDesignStore.getState().activeTabId,
      direction: 'row',
      origin: { x: 80, y: 80 },
      slots: [{ label: 'A', width: 400, height: 300 }],
    });

  beforeEach(() => {
    useDesignStore.getState().createNewDocument();
    useGenerationStore.setState({ run: null });
  });

  it('keeps an in-flight run out of the document and its history', () => {
    const before = useDesignStore.getState();
    const started = run();
    useGenerationStore.getState().startRun(started);
    useGenerationStore.getState().patchSlot('run1', started.slots[0].id, { status: 'done', frame: frame('A', 0, 0) });

    const after = useDesignStore.getState();
    expect(useGenerationStore.getState().run?.slots[0].status).toBe('done');
    expect(after.document).toBe(before.document);
    expect(after.history).toHaveLength(before.history.length);
    expect(after.isDirty).toBe(before.isDirty);
  });

  it('ignores updates for a run that is no longer current', () => {
    const started = run();
    useGenerationStore.getState().startRun(started);
    useGenerationStore.getState().patchSlot('other-run', started.slots[0].id, { status: 'done' });
    expect(useGenerationStore.getState().run?.slots[0].status).toBe('queued');
    useGenerationStore.getState().clearRun('other-run');
    expect(useGenerationStore.getState().run).not.toBeNull();
    useGenerationStore.getState().clearRun('run1');
    expect(useGenerationStore.getState().run).toBeNull();
  });

  it('commits placed frames at their positions as one undo step', () => {
    const store = useDesignStore.getState();
    const historyBefore = store.history.length;
    const ok = store.appendPlacedFrames(store.activeTabId, [frame('A', 500, 60), frame('B', 500, 360)]);

    const state = useDesignStore.getState();
    expect(ok).toBe(true);
    expect(state.document.children.map((n) => [n.name, n.x, n.y])).toEqual([
      ['A', 500, 60],
      ['B', 500, 360],
    ]);
    expect(state.history).toHaveLength(historyBefore + 1);
    state.undo();
    expect(useDesignStore.getState().document.children).toHaveLength(0);
  });

  it('commits into a background tab and refuses a closed one', () => {
    const originTabId = useDesignStore.getState().activeTabId;
    useDesignStore.getState().createNewDocument();
    expect(useDesignStore.getState().appendPlacedFrames(originTabId, [frame('A', 10, 20)])).toBe(true);
    const origin = useDesignStore.getState().tabs.find((t) => t.id === originTabId)!;
    expect(origin.document.children.map((n) => n.x)).toEqual([10]);
    expect(useDesignStore.getState().document.children).toHaveLength(0);
    expect(useDesignStore.getState().appendPlacedFrames('tab-gone', [frame('A', 0, 0)])).toBe(false);
  });
});
