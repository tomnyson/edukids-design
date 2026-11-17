import type { FrameNode } from '../types/pen-ast';
import type { Viewport } from '../store/document-tabs';
import type { AgentProgress } from './agent-chat';

/** Gap between side-by-side slots; matches the gap between generated designs */
export const RUN_GAP = 80;
const FIT_MARGIN = 48;
const MIN_ZOOM = 0.05;
const MAX_FIT_ZOOM = 1;

export type SlotStatus = 'queued' | 'running' | 'done' | 'error';

/** One agent's place on the canvas: a placeholder until its frame arrives */
export interface GenerationSlot {
  id: string;
  /** Agent order, 0-based */
  index: number;
  /** Section name or art-direction name */
  label: string;
  status: SlotStatus;
  /** Planned size until the agent finishes, the real size after */
  width: number;
  height: number;
  frame?: FrameNode;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

/**
 * A generation in flight. It lives next to the document, not in it, so
 * placeholders and half-finished runs never reach history, saves or exports.
 */
export interface GenerationRun {
  id: string;
  tabId: string;
  direction: 'row' | 'column';
  origin: { x: number; y: number };
  slots: GenerationSlot[];
}

export type SlotPatch = Partial<Omit<GenerationSlot, 'id' | 'index'>>;

export interface PlacedSlot {
  slot: GenerationSlot;
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NewRun {
  id: string;
  tabId: string;
  direction: 'row' | 'column';
  origin: { x: number; y: number };
  slots: Array<Pick<GenerationSlot, 'label' | 'width' | 'height'>>;
}

export function createRun(input: NewRun): GenerationRun {
  return {
    id: input.id,
    tabId: input.tabId,
    direction: input.direction,
    origin: input.origin,
    slots: input.slots.map((slot, index) => ({ ...slot, id: `${input.id}:${index}`, index, status: 'queued' })),
  };
}

/** `run` with one slot changed; the same run when the slot does not exist */
export function patchSlot(run: GenerationRun, slotId: string, patch: SlotPatch): GenerationRun {
  if (!run.slots.some((slot) => slot.id === slotId)) return run;
  return { ...run, slots: run.slots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)) };
}

function place(run: GenerationRun, slots: GenerationSlot[]): PlacedSlot[] {
  let offset = 0;
  return slots.map((slot) => {
    const placed =
      run.direction === 'row'
        ? { slot, x: run.origin.x + offset, y: run.origin.y }
        : { slot, x: run.origin.x, y: run.origin.y + offset };
    offset += run.direction === 'row' ? slot.width + RUN_GAP : slot.height;
    return placed;
  });
}

/** Canvas position of every slot: a row with gaps, or a column with none */
export function layoutRun(run: GenerationRun): PlacedSlot[] {
  return place(run, run.slots);
}

/** Finished frames at their final positions; failed slots take no space */
export function committedFrames(run: GenerationRun): FrameNode[] {
  const finished = run.slots.filter((slot) => slot.status === 'done' && slot.frame);
  return place(run, finished).map(({ slot, x, y }) => ({ ...(slot.frame as FrameNode), x, y }));
}

export function isRunSettled(run: GenerationRun): boolean {
  return run.slots.every((slot) => slot.status === 'done' || slot.status === 'error');
}

export function runBounds(run: GenerationRun): Bounds {
  const placed = layoutRun(run);
  const right = Math.max(...placed.map((p) => p.x + p.slot.width));
  const bottom = Math.max(...placed.map((p) => p.y + p.slot.height));
  return { x: run.origin.x, y: run.origin.y, width: right - run.origin.x, height: bottom - run.origin.y };
}

/** Viewport that shows all of `bounds` centred in the container; null when the container has no size */
export function fitViewport(bounds: Bounds, container: { width: number; height: number }): Viewport | null {
  const availableWidth = container.width - 2 * FIT_MARGIN;
  const availableHeight = container.height - 2 * FIT_MARGIN;
  if (availableWidth <= 0 || availableHeight <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;
  const zoom = Math.max(
    MIN_ZOOM,
    Math.min(MAX_FIT_ZOOM, availableWidth / bounds.width, availableHeight / bounds.height)
  );
  return {
    zoom,
    x: (container.width - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: (container.height - bounds.height * zoom) / 2 - bounds.y * zoom,
  };
}

export function slotTitle(slot: Pick<GenerationSlot, 'index' | 'label'>): string {
  return `Agent ${slot.index + 1} · ${slot.label}`;
}

/** Per-agent rows for the chat reply */
export function agentProgressOf(run: GenerationRun): AgentProgress[] {
  return run.slots.map((slot) => ({
    label: slotTitle(slot),
    status: slot.status,
    ...(slot.startedAt !== undefined && slot.finishedAt !== undefined
      ? { durationMs: slot.finishedAt - slot.startedAt }
      : {}),
    ...(slot.error ? { error: slot.error } : {}),
  }));
}
