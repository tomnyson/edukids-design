import { PenNode } from '../types/pen-ast';
import { Viewport } from '../store/document-tabs';

export type CanvasTool = 'select' | 'frame' | 'rect' | 'ellipse' | 'text';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 5;
/** Zoom buttons multiply or divide by this, so + then - returns to the same zoom */
export const ZOOM_STEP = 1.2;
/** Arrow keys move the selection 1px, or this much with Shift */
export const NUDGE_LARGE = 10;
/** Offset for pasted and duplicated nodes, so the copy is visible next to the original */
export const PASTE_OFFSET = 16;

const TOOL_KEYS: Record<string, CanvasTool> = {
  v: 'select',
  f: 'frame',
  r: 'rect',
  o: 'ellipse',
  t: 'text',
};

interface KeyLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey?: boolean;
}

/** True when keystrokes belong to a form field rather than to canvas shortcuts */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).tagName !== 'string') return false;
  const el = target as HTMLElement;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable === true;
}

/** Tool for a single-letter shortcut; modified keys (Cmd+R, Cmd+T) stay with the browser */
export function toolForKey(e: KeyLike): CanvasTool | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  return TOOL_KEYS[e.key.toLowerCase()] ?? null;
}

/** Movement for an arrow key, or null for any other key */
export function nudgeForKey(e: KeyLike): { dx: number; dy: number } | null {
  const step = e.shiftKey ? NUDGE_LARGE : 1;
  switch (e.key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 };
    case 'ArrowRight':
      return { dx: step, dy: 0 };
    case 'ArrowUp':
      return { dx: 0, dy: -step };
    case 'ArrowDown':
      return { dx: 0, dy: step };
    default:
      return null;
  }
}

/** Viewport zoomed by `factor` while the canvas point under `pivot` (screen px) stays put */
export function zoomAround(viewport: Viewport, factor: number, pivot: { x: number; y: number }): Viewport {
  const zoom = Math.min(Math.max(viewport.zoom * factor, MIN_ZOOM), MAX_ZOOM);
  const ratio = zoom / viewport.zoom;
  return {
    x: pivot.x - (pivot.x - viewport.x) * ratio,
    y: pivot.y - (pivot.y - viewport.y) * ratio,
    zoom,
  };
}

/** Space kept around a frame when the canvas zooms to fit it */
export const FIT_PADDING = 48;

interface Size {
  width: number;
  height: number;
}

/**
 * Viewport that centres `bounds` (canvas units) in a canvas of `canvas` size
 * (screen px), zoomed to fit inside `padding` but never past 100%
 */
export function fitViewportToBounds(
  bounds: { x: number; y: number } & Size,
  canvas: Size,
  padding: number = FIT_PADDING
): Viewport {
  const width = Math.max(bounds.width, 1);
  const height = Math.max(bounds.height, 1);
  const room = (size: number) => Math.max(size - padding * 2, 1);
  const fit = Math.min(room(canvas.width) / width, room(canvas.height) / height, 1);
  const zoom = Math.min(Math.max(fit, MIN_ZOOM), MAX_ZOOM);
  return {
    x: (canvas.width - width * zoom) / 2 - bounds.x * zoom,
    y: (canvas.height - height * zoom) / 2 - bounds.y * zoom,
    zoom,
  };
}

/** Deep copy of `node` with fresh ids on it and every descendant; a copied component master is a plain frame */
export function cloneWithNewIds(node: PenNode, makeId: () => string): PenNode {
  const { reusable: _reusable, ...rest } = node as PenNode & { reusable?: boolean };
  const copy = { ...rest, id: makeId() } as PenNode;
  if ('children' in node && Array.isArray(node.children)) {
    return { ...copy, children: node.children.map((child) => cloneWithNewIds(child, makeId)) } as PenNode;
  }
  return copy;
}

/** Id of the node containing `id`: null at the top level, undefined when `id` is not in the tree */
export function findParentId(nodes: PenNode[], id: string, parentId: string | null = null): string | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    if ('children' in node && node.children) {
      const found = findParentId(node.children, id, node.id);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Selected ids minus those inside another selected node, so a group moves or copies once */
export function topmostSelected(nodes: PenNode[], selectedIds: string[]): string[] {
  const selected = new Set(selectedIds);
  const result: string[] = [];
  const walk = (list: PenNode[]) => {
    for (const node of list) {
      if (selected.has(node.id)) {
        result.push(node.id);
      } else if ('children' in node && node.children) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

/** `nodes` with `node` appended to the children of `parentId` (or the top level for null) */
export function appendToParent(nodes: PenNode[], parentId: string | null, node: PenNode): PenNode[] {
  if (parentId === null) return [...nodes, node];
  return nodes.map((item) => {
    if (!('children' in item) || !item.children) return item;
    if (item.id === parentId) return { ...item, children: [...item.children, node] } as PenNode;
    return { ...item, children: appendToParent(item.children, parentId, node) } as PenNode;
  });
}
