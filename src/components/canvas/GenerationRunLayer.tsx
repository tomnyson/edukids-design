import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { useGenerationStore } from '../../store/useGenerationStore';
import { GenerationSlot, fitViewport, layoutRun, runBounds, slotTitle } from '../../lib/generation-run';
import { NodeRenderer } from './NodeRenderer';

interface GenerationPlaceholderProps {
  slot: GenerationSlot;
  x: number;
  y: number;
}

/** Reserved place of an agent that has not delivered its frame yet */
export function GenerationPlaceholder({ slot, x, y }: GenerationPlaceholderProps) {
  const failed = slot.status === 'error';
  return (
    <div
      data-generation-slot={slot.status}
      className={`absolute flex flex-col items-center justify-center gap-5 rounded-lg border-2 border-dashed text-center ${
        failed ? 'border-red-500/50 bg-red-950/20 text-red-200' : 'border-amber-500/40 bg-amber-500/5 text-amber-200'
      }`}
      style={{ left: x, top: y, width: slot.width, height: slot.height }}
    >
      {failed ? (
        <AlertTriangle className="h-16 w-16" aria-hidden />
      ) : (
        <Loader2 className={`h-16 w-16 ${slot.status === 'running' ? 'animate-spin' : 'opacity-40'}`} aria-hidden />
      )}
      <span className="text-5xl font-semibold">{slotTitle(slot)}</span>
      <span className="max-w-[80%] text-3xl opacity-70">
        {failed ? slot.error ?? 'Lỗi' : slot.status === 'running' ? 'Đang sinh…' : 'Đang chờ…'}
      </span>
    </div>
  );
}

/**
 * Draws the generation in flight over the canvas: finished frames as static
 * copies, the rest as placeholders. Nothing here is part of the document, so
 * it cannot be selected, dragged, saved or undone until the run commits.
 */
export function GenerationRunLayer() {
  const run = useGenerationStore((state) => state.run);
  const activeTabId = useDesignStore((state) => state.activeTabId);
  if (!run || run.tabId !== activeTabId) return null;

  return (
    <div style={{ pointerEvents: 'none' }} aria-hidden>
      {layoutRun(run).map(({ slot, x, y }) =>
        slot.status === 'done' && slot.frame ? (
          <NodeRenderer key={slot.id} node={{ ...slot.frame, x, y }} isRoot preview />
        ) : (
          <GenerationPlaceholder key={slot.id} slot={slot} x={x} y={y} />
        )
      )}
    </div>
  );
}

/**
 * Brings a new run into view once, when it starts in the tab being shown.
 * The view is never moved again for that run, so the user can pan freely.
 */
export function useFitGenerationRun(containerRef: React.RefObject<HTMLDivElement | null>): void {
  const runId = useGenerationStore((state) => state.run?.id ?? null);
  const handledRunId = useRef<string | null>(null);

  useEffect(() => {
    if (!runId || handledRunId.current === runId) return;
    handledRunId.current = runId;
    const { run } = useGenerationStore.getState();
    const { activeTabId, setViewport } = useDesignStore.getState();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!run || run.tabId !== activeTabId || !rect) return;
    const view = fitViewport(runBounds(run), { width: rect.width, height: rect.height });
    if (view) setViewport(view.x, view.y, view.zoom);
  }, [runId, containerRef]);
}
