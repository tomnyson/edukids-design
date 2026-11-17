import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PLAN_TOOL_NAME,
  PLAN_TIMEOUT_MS,
  PagePlan,
  buildPlanRequest,
  extractPagePlan,
  fallbackPlan,
  planPage,
} from '../../src/generator/page-plan';
import { parseBridgeRequest } from '../../server/claude-cli';
import type { DesignMessage } from '../../src/generator/design-generator';

const PLAN_INPUT = {
  width: 1440,
  palette: { background: '#0b0c10', surface: '#15171f', text: '#f5f5f5', mutedText: '#9aa0aa', accent: '#22d3ee' },
  fonts: { heading: 'Space Grotesk', body: 'Inter' },
  styleNotes: 'Dense, technical, calm.',
  sections: [
    { name: 'Sidebar and header', brief: 'Navigation and fleet summary', estimatedHeight: 300 },
    { name: 'Robot grid', brief: 'Status cards for each robot', estimatedHeight: 900 },
  ],
};

function planMessage(input: unknown, stopReason = 'tool_use'): DesignMessage {
  return { stop_reason: stopReason, content: [{ type: 'tool_use', name: PLAN_TOOL_NAME, input }] };
}

const baseOptions = { prompt: 'Robot fleet dashboard', attachments: [], modelId: 'claude-haiku-5-5', count: 2 };

afterEach(() => {
  vi.useRealTimers();
});

describe('buildPlanRequest', () => {
  it('fits the bridge request shape and forces the plan tool', () => {
    const request = buildPlanRequest(baseOptions);
    expect(() => parseBridgeRequest(request)).not.toThrow();
    expect(request.tool_choice).toEqual({ type: 'tool', name: PLAN_TOOL_NAME });
    const text = JSON.stringify(request.messages);
    expect(text).toContain('Robot fleet dashboard');
    expect(text).toContain('exactly 2 sections');
  });

  it('sends attachments to the planner', () => {
    const request = buildPlanRequest({
      ...baseOptions,
      attachments: [
        { id: '1', type: 'image', name: 'ref.png', previewUrl: 'data:image/png;base64,AAAA' },
        { id: '2', type: 'file', name: 'DESIGN.md', content: 'Use teal.' },
      ],
    });
    const content = request.messages[0].content;
    expect(content.some((block) => block.type === 'image')).toBe(true);
    expect(JSON.stringify(content)).toContain('Use teal.');
  });
});

describe('extractPagePlan', () => {
  it('accepts a valid plan with the requested number of sections', () => {
    const plan = extractPagePlan(planMessage(PLAN_INPUT), 2);
    expect(plan.width).toBe(1440);
    expect(plan.sections.map((s) => s.name)).toEqual(['Sidebar and header', 'Robot grid']);
    expect(plan.palette.accent).toBe('#22d3ee');
  });

  it('clamps width and section heights into a usable range', () => {
    const plan = extractPagePlan(
      planMessage({
        ...PLAN_INPUT,
        width: 9000,
        sections: [
          { ...PLAN_INPUT.sections[0], estimatedHeight: 5 },
          { ...PLAN_INPUT.sections[1], estimatedHeight: 99999 },
        ],
      }),
      2
    );
    expect(plan.width).toBe(1920);
    expect(plan.sections[0].estimatedHeight).toBe(200);
    expect(plan.sections[1].estimatedHeight).toBe(3000);
  });

  it('rejects a wrong section count', () => {
    expect(() => extractPagePlan(planMessage(PLAN_INPUT), 3)).toThrow();
  });

  it('rejects an invalid shape, a missing tool call and truncated output', () => {
    expect(() => extractPagePlan(planMessage({ ...PLAN_INPUT, palette: { accent: 'teal' } }), 2)).toThrow();
    expect(() => extractPagePlan({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hi' }] }, 2)).toThrow();
    expect(() => extractPagePlan(planMessage(PLAN_INPUT, 'max_tokens'), 2)).toThrow();
  });
});

describe('fallbackPlan', () => {
  it('uses the hardcoded section list, closing with the footer', () => {
    const plan = fallbackPlan(3);
    expect(plan.sections).toHaveLength(3);
    expect(plan.sections[0].name).toBe('Navigation bar and hero');
    expect(plan.sections[2].name).toBe('Final call to action and footer');
    expect(plan.width).toBe(1280);
    expect(plan.sections.every((s) => s.estimatedHeight === 800)).toBe(true);
  });
});

describe('planPage', () => {
  it('returns the model plan when it is valid', async () => {
    const result = await planPage({ ...baseOptions, createMessage: async () => planMessage(PLAN_INPUT) });
    expect(result.usedFallback).toBe(false);
    expect(result.plan.sections[1].name).toBe('Robot grid');
  });

  it('falls back when the planner throws', async () => {
    const result = await planPage({
      ...baseOptions,
      createMessage: async () => {
        throw new Error('rate limited');
      },
    });
    expect(result.usedFallback).toBe(true);
    expect(result.plan).toEqual(fallbackPlan(2));
  });

  it('falls back when the plan is invalid', async () => {
    const result = await planPage({ ...baseOptions, count: 4, createMessage: async () => planMessage(PLAN_INPUT) });
    expect(result.usedFallback).toBe(true);
    expect(result.plan.sections).toHaveLength(4);
  });

  it('falls back after the deadline and ignores a late plan', async () => {
    vi.useFakeTimers();
    expect(PLAN_TIMEOUT_MS).toBe(60_000);
    let resolveLate: (message: DesignMessage) => void = () => {};
    const pending = planPage({
      ...baseOptions,
      createMessage: () => new Promise<DesignMessage>((resolve) => (resolveLate = resolve)),
    });
    await vi.advanceTimersByTimeAsync(PLAN_TIMEOUT_MS);
    const result = await pending;
    resolveLate(planMessage(PLAN_INPUT));
    expect(result.usedFallback).toBe(true);
    expect(result.plan satisfies PagePlan).toEqual(fallbackPlan(2));
  });
});
