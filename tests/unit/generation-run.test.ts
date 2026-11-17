import { describe, it, expect } from 'vitest';
import {
  RUN_GAP,
  agentProgressOf,
  committedFrames,
  createRun,
  fitViewport,
  isRunSettled,
  layoutRun,
  patchSlot,
  runBounds,
} from '../../src/lib/generation-run';
import { FrameNode } from '../../src/types/pen-ast';

const frame = (name: string, width: number, height: number): FrameNode => ({
  id: `f-${name}`,
  type: 'frame',
  name,
  x: 0,
  y: 0,
  width,
  height,
  children: [],
});

const newRun = (direction: 'row' | 'column', labels: string[]) =>
  createRun({
    id: 'run1',
    tabId: 'tab1',
    direction,
    origin: { x: 100, y: 50 },
    slots: labels.map((label) => ({ label, width: 1280, height: 800 })),
  });

describe('createRun', () => {
  it('creates queued slots in agent order with stable ids', () => {
    const run = newRun('row', ['A', 'B']);
    expect(run.slots.map((s) => [s.index, s.label, s.status])).toEqual([
      [0, 'A', 'queued'],
      [1, 'B', 'queued'],
    ]);
    expect(new Set(run.slots.map((s) => s.id)).size).toBe(2);
  });
});

describe('patchSlot', () => {
  it('returns a new run and leaves the original untouched', () => {
    const run = newRun('row', ['A', 'B']);
    const next = patchSlot(run, run.slots[1].id, { status: 'running', startedAt: 10 });
    expect(next.slots[1]).toMatchObject({ status: 'running', startedAt: 10 });
    expect(run.slots[1].status).toBe('queued');
    expect(next.slots[0]).toBe(run.slots[0]);
  });

  it('ignores an unknown slot id', () => {
    const run = newRun('row', ['A']);
    expect(patchSlot(run, 'nope', { status: 'done' })).toBe(run);
  });
});

describe('layoutRun', () => {
  it('lays a row out left to right with the gap', () => {
    const placed = layoutRun(newRun('row', ['A', 'B', 'C']));
    expect(placed.map((p) => [p.x, p.y])).toEqual([
      [100, 50],
      [100 + 1280 + RUN_GAP, 50],
      [100 + 2 * (1280 + RUN_GAP), 50],
    ]);
  });

  it('stacks a column with no gap', () => {
    const placed = layoutRun(newRun('column', ['A', 'B']));
    expect(placed.map((p) => [p.x, p.y])).toEqual([
      [100, 50],
      [100, 850],
    ]);
  });

  it('reflows later slots when a real size replaces the planned one', () => {
    const run = newRun('column', ['A', 'B', 'C']);
    const done = patchSlot(run, run.slots[0].id, { status: 'done', frame: frame('A', 1280, 300), width: 1280, height: 300 });
    expect(layoutRun(done).map((p) => p.y)).toEqual([50, 350, 1150]);
  });

  it('keeps a failed slot in place during the run', () => {
    const run = newRun('row', ['A', 'B']);
    const failed = patchSlot(run, run.slots[0].id, { status: 'error', error: 'boom' });
    expect(layoutRun(failed)[1].x).toBe(100 + 1280 + RUN_GAP);
  });
});

describe('committedFrames', () => {
  it('positions finished frames and closes the gaps of failed slots', () => {
    let run = newRun('column', ['A', 'B', 'C']);
    run = patchSlot(run, run.slots[0].id, { status: 'done', frame: frame('A', 1280, 400), width: 1280, height: 400 });
    run = patchSlot(run, run.slots[1].id, { status: 'error', error: 'boom' });
    run = patchSlot(run, run.slots[2].id, { status: 'done', frame: frame('C', 1280, 600), width: 1280, height: 600 });
    const frames = committedFrames(run);
    expect(frames.map((f) => [f.name, f.x, f.y])).toEqual([
      ['A', 100, 50],
      ['C', 100, 450],
    ]);
  });

  it('is empty when nothing finished', () => {
    expect(committedFrames(newRun('row', ['A']))).toEqual([]);
  });
});

describe('isRunSettled', () => {
  it('is true only when every slot is done or failed', () => {
    let run = newRun('row', ['A', 'B']);
    expect(isRunSettled(run)).toBe(false);
    run = patchSlot(run, run.slots[0].id, { status: 'done', frame: frame('A', 10, 10) });
    run = patchSlot(run, run.slots[1].id, { status: 'error' });
    expect(isRunSettled(run)).toBe(true);
  });
});

describe('runBounds and fitViewport', () => {
  it('bounds the whole run', () => {
    expect(runBounds(newRun('row', ['A', 'B']))).toEqual({ x: 100, y: 50, width: 2 * 1280 + RUN_GAP, height: 800 });
  });

  it('zooms out and centres the run inside the container', () => {
    const bounds = { x: 100, y: 50, width: 2000, height: 1000 };
    const view = fitViewport(bounds, { width: 1096, height: 800 })!;
    expect(view.zoom).toBeCloseTo(0.5);
    expect(view.x).toBeCloseTo((1096 - 2000 * 0.5) / 2 - 100 * 0.5);
    expect(view.y).toBeCloseTo((800 - 1000 * 0.5) / 2 - 50 * 0.5);
  });

  it('never zooms in past 100% and respects the minimum zoom', () => {
    expect(fitViewport({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 1000 })?.zoom).toBe(1);
    expect(fitViewport({ x: 0, y: 0, width: 1e7, height: 100 }, { width: 1000, height: 1000 })?.zoom).toBe(0.05);
  });

  it('returns null for an unusable container', () => {
    expect(fitViewport({ x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 0 })).toBeNull();
  });
});

describe('agentProgressOf', () => {
  it('describes each agent with its label, status, duration and error', () => {
    let run = newRun('row', ['Editorial', 'Bento']);
    run = patchSlot(run, run.slots[0].id, { status: 'done', startedAt: 1000, finishedAt: 4500 });
    run = patchSlot(run, run.slots[1].id, { status: 'error', startedAt: 1000, finishedAt: 2000, error: 'rate limited' });
    expect(agentProgressOf(run)).toEqual([
      { label: 'Agent 1 · Editorial', status: 'done', durationMs: 3500 },
      { label: 'Agent 2 · Bento', status: 'error', durationMs: 1000, error: 'rate limited' },
    ]);
  });
});
