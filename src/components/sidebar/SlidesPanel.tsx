import React, { useEffect, useRef } from 'react';
import { Monitor } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { FrameNode, PenNode } from '../../types/pen-ast';
import { findTopLevelId } from '../../compiler/ast-to-html';
import { fitViewportToBounds } from '../../lib/canvas-editing';
import { CANVAS_ELEMENT_ID } from '../../lib/image-insert';
import { FrameThumbnail } from './FrameThumbnail';

const THUMB_WIDTH = 232;
const THUMB_HEIGHT = 148;

/** Selects `frame` and zooms the canvas so the whole frame is in view */
function focusFrame(frame: FrameNode) {
  const store = useDesignStore.getState();
  store.selectNode(frame.id);
  const canvas = document.getElementById(CANVAS_ELEMENT_ID);
  if (!canvas) return;
  const { width, height } = canvas.getBoundingClientRect();
  const next = fitViewportToBounds(
    { x: frame.x ?? 0, y: frame.y ?? 0, width: frame.width ?? 0, height: frame.height ?? 0 },
    { width, height }
  );
  store.setViewport(next.x, next.y, next.zoom);
}

/** The document's slides: its top-level frames, in canvas order */
export function slidesOf(nodes: PenNode[]): FrameNode[] {
  return nodes.filter((node): node is FrameNode => node.type === 'frame');
}

/** Id of the top-level node holding the first selected node, or null with nothing selected */
export function activeSlideId(nodes: PenNode[], selectedIds: string[]): string | null {
  return selectedIds.length > 0 ? findTopLevelId(nodes, selectedIds[0]) : null;
}

interface SlidesListProps {
  frames: FrameNode[];
  activeId: string | null;
  onSelect: (frame: FrameNode) => void;
}

/** Every slide as a numbered thumbnail; the active one is highlighted and kept in view */
export function SlidesList({ frames, activeId, onSelect }: SlidesListProps) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);
  if (frames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500 text-xs p-4">
        <Monitor className="h-8 w-8 mb-2 text-zinc-600 stroke-[1.5]" />
        <p className="font-medium text-zinc-400">Tài liệu trống</p>
        <p className="text-[11px] text-zinc-600 mt-1">
          Chưa có frame nào. Dùng công cụ Frame (F) hoặc yêu cầu Agent để tạo.
        </p>
      </div>
    );
  }

  return (
    <ol className="p-3 space-y-2" aria-label="Slides">
      {frames.map((frame, i) => {
        const isActive = frame.id === activeId;
        const name = frame.name || `Screen ${i + 1}`;
        return (
          <li key={frame.id}>
            <button
              ref={isActive ? activeRef : undefined}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              aria-label={`Slide ${i + 1}: ${name}`}
              onClick={() => onSelect(frame)}
              className={`group flex w-full gap-2 rounded-xl border p-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                isActive
                  ? 'bg-[#1b1e2e] border-sky-500/60'
                  : 'bg-[#141520] border-[#222434] hover:border-[#34374f] hover:bg-[#181a27]'
              }`}
            >
              <span
                className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-mono ${
                  isActive ? 'bg-sky-500 text-white' : 'bg-[#1e2030] text-zinc-400'
                }`}
              >
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="rounded-lg bg-[#0b0c12] ring-1 ring-[#1f2132]">
                  <FrameThumbnail frame={frame} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
                </span>
                <span className="flex items-center justify-between gap-2 px-0.5">
                  <span className={`truncate text-[11px] ${isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                    {name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                    {frame.width}×{frame.height}
                  </span>
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SlidesPanel() {
  const nodes = useDesignStore((state) => state.document.children);
  const activeId = useDesignStore((state) => activeSlideId(state.document.children, state.selectedNodeIds));
  return <SlidesList frames={slidesOf(nodes)} activeId={activeId} onSelect={focusFrame} />;
}
