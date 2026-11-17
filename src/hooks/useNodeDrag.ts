import React, { useCallback } from 'react';
import { useDesignStore } from '../store/useDesignStore';
import { topmostSelected } from '../lib/canvas-editing';

/** Screen px the pointer must travel before a press on a node becomes a drag rather than a click */
const DRAG_THRESHOLD = 3;
export const NODE_ID_PREFIX = 'node-';

function nodeElement(id: string): HTMLElement | null {
  return document.getElementById(`${NODE_ID_PREFIX}${id}`);
}

/** Swallows the click that follows a drag, so dropping a node does not change the selection */
export function suppressNextClick() {
  const stop = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  // No click follows when the pointer is released over another element
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

/**
 * Moves canvas nodes with the mouse. While dragging, nodes are offset with
 * CSS `translate` only; the document changes once on release, so the whole
 * drag is a single undo step.
 */
export function useNodeDrag(): (e: React.MouseEvent) => boolean {
  return useCallback((e: React.MouseEvent) => {
    const hit = (e.target as Element).closest?.(`[id^="${NODE_ID_PREFIX}"]`);
    if (!hit || e.button !== 0) return false;
    const nodeId = hit.id.slice(NODE_ID_PREFIX.length);

    const { selectedNodeIds, document: doc } = useDesignStore.getState();
    // Dragging part of the selection moves all of it; anything else moves only the pressed node
    const ids = selectedNodeIds.includes(nodeId) ? topmostSelected(doc.children, selectedNodeIds) : [nodeId];
    const elements = ids.map(nodeElement).filter((el): el is HTMLElement => el !== null);
    const start = { x: e.clientX, y: e.clientY };
    let delta = { x: 0, y: 0 };
    let dragging = false;

    const handleMove = (move: MouseEvent) => {
      const screenDx = move.clientX - start.x;
      const screenDy = move.clientY - start.y;
      if (!dragging && Math.hypot(screenDx, screenDy) < DRAG_THRESHOLD) return;
      dragging = true;
      const { zoom } = useDesignStore.getState().viewport;
      delta = { x: Math.round(screenDx / zoom), y: Math.round(screenDy / zoom) };
      elements.forEach((el) => {
        el.style.translate = `${delta.x}px ${delta.y}px`;
      });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      elements.forEach((el) => {
        el.style.translate = '';
      });
      if (!dragging) return;
      suppressNextClick();
      const store = useDesignStore.getState();
      store.moveNodes(ids, delta.x, delta.y);
      if (!selectedNodeIds.includes(nodeId)) store.selectNode(nodeId);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return true;
  }, []);
}
