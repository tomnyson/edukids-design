import React, { useMemo } from 'react';
import { Component } from 'lucide-react';
import { useDesignStore } from '../../store/useDesignStore';
import { FrameNode } from '../../types/pen-ast';
import { listMasters } from '../../lib/components';
import { instancePlacement } from '../../lib/component-placement';
import { CANVAS_ELEMENT_ID } from '../../lib/image-insert';
import { notify } from '../../lib/toast';
import { FrameThumbnail } from './FrameThumbnail';

const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 84;

interface ComponentsListProps {
  masters: FrameNode[];
  onInsert: (master: FrameNode) => void;
}

/** Every component master as a thumbnail card; clicking one inserts an instance */
export function ComponentsList({ masters, onInsert }: ComponentsListProps) {
  if (masters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500 text-xs p-4">
        <Component className="h-8 w-8 mb-2 text-violet-400/50 stroke-[1.5]" />
        <p className="font-medium text-zinc-400">Chưa có component</p>
        <p className="text-[11px] text-zinc-600 mt-1">
          Chọn layer, chuột phải rồi chọn Create Component (⌘⌥K).
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      <p className="px-0.5 text-[11px] text-zinc-500">Bấm để chèn vào frame đang chọn</p>
      <ul className="grid grid-cols-2 gap-2" aria-label="Components">
        {masters.map((master) => {
          const name = master.name || 'Component';
          return (
            <li key={master.id}>
              <button
                type="button"
                aria-label={`Chèn ${name}`}
                onClick={() => onInsert(master)}
                className="group flex w-full flex-col gap-1.5 rounded-xl border border-[#222434] bg-[#141520] p-1.5 text-left transition hover:border-violet-500/50 hover:bg-[#181a27] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
              >
                <span className="rounded-lg bg-[#0b0c12] ring-1 ring-[#1f2132] group-hover:ring-violet-500/30">
                  <FrameThumbnail frame={master} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
                </span>
                <span className="flex items-center gap-1 px-0.5">
                  <Component className="h-3 w-3 shrink-0 text-violet-400" />
                  <span className="truncate text-[11px] text-zinc-400 group-hover:text-zinc-100">{name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function canvasSize(): { width: number; height: number } {
  const rect = document.getElementById(CANVAS_ELEMENT_ID)?.getBoundingClientRect();
  return rect ? { width: rect.width, height: rect.height } : { width: window.innerWidth, height: window.innerHeight };
}

function insertMaster(master: FrameNode) {
  const { document: doc, selectedNodeIds, viewport, insertInstance } = useDesignStore.getState();
  const placement = instancePlacement(doc.children, selectedNodeIds, viewport, canvasSize(), master);
  if (!insertInstance(master.id, placement)) notify('❌ Không chèn được component này');
}

export function ComponentsPanel() {
  const nodes = useDesignStore((state) => state.document.children);
  const masters = useMemo(() => listMasters(nodes), [nodes]);
  return <ComponentsList masters={masters} onInsert={insertMaster} />;
}
