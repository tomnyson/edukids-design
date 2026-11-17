import { FrameNode, PenNode } from '../types/pen-ast';
import { findParentId } from './canvas-editing';

export type ZOrder = 'front' | 'back';
export type WrapKind = 'group' | 'frame';

export interface Point {
  x: number;
  y: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function unionBounds(nodes: PenNode[]): Bounds {
  const left = Math.min(...nodes.map((n) => n.x ?? 0));
  const top = Math.min(...nodes.map((n) => n.y ?? 0));
  const right = Math.max(...nodes.map((n) => (n.x ?? 0) + (n.width ?? 0)));
  const bottom = Math.max(...nodes.map((n) => (n.y ?? 0) + (n.height ?? 0)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function offset(node: PenNode, dx: number, dy: number): PenNode {
  return { ...node, x: (node.x ?? 0) + dx, y: (node.y ?? 0) + dy } as PenNode;
}

function childrenOf(node: PenNode): PenNode[] | undefined {
  return 'children' in node && Array.isArray(node.children) ? node.children : undefined;
}

/** `nodes` with the child list of `parentId` (the top level for null) replaced by `update(list)` */
function updateSiblings(nodes: PenNode[], parentId: string | null, update: (list: PenNode[]) => PenNode[]): PenNode[] {
  if (parentId === null) return update(nodes);
  return nodes.map((node) => {
    const children = childrenOf(node);
    if (!children) return node;
    if (node.id === parentId) return { ...node, children: update(children) } as PenNode;
    return { ...node, children: updateSiblings(children, parentId, update) } as PenNode;
  });
}

/** Moves each node in `ids` to the top (`front`) or bottom (`back`) of its own parent, keeping their order */
export function reorderInParent(nodes: PenNode[], ids: string[], order: ZOrder): PenNode[] {
  const moving = new Set(ids);
  const parents = new Set(ids.map((id) => findParentId(nodes, id)).filter((p): p is string | null => p !== undefined));
  return [...parents].reduce(
    (tree, parentId) =>
      updateSiblings(tree, parentId, (list) => {
        const moved = list.filter((n) => moving.has(n.id));
        const rest = list.filter((n) => !moving.has(n.id));
        return order === 'front' ? [...rest, ...moved] : [...moved, ...rest];
      }),
    nodes
  );
}

/**
 * Wraps sibling nodes in a new frame placed at their union bounds, with the
 * children made relative to it. Null when the nodes do not share one parent.
 */
export function wrapNodes(nodes: PenNode[], ids: string[], kind: WrapKind, wrapperId: string): PenNode[] | null {
  if (ids.length === 0) return null;
  const parents = new Set(ids.map((id) => findParentId(nodes, id)));
  if (parents.size !== 1 || parents.has(undefined)) return null;
  const [parentId] = [...parents] as (string | null)[];
  const wrapping = new Set(ids);

  return updateSiblings(nodes, parentId, (list) => {
    const wrapped = list.filter((n) => wrapping.has(n.id));
    const bounds = unionBounds(wrapped);
    const wrapper: FrameNode = {
      id: wrapperId,
      type: 'frame',
      name: kind === 'group' ? 'Group' : 'Frame',
      ...bounds,
      clip: kind === 'frame',
      layout: 'none',
      children: wrapped.map((n) => offset(n, -bounds.x, -bounds.y)),
    };
    // The wrapper sits where the highest wrapped node was, so it stays above the same siblings
    const lastIndex = Math.max(...wrapped.map((n) => list.indexOf(n)));
    return list.flatMap((n, index) => (index === lastIndex ? [wrapper] : wrapping.has(n.id) ? [] : [n]));
  });
}

/** Replaces each frame in `ids` that has children by those children, moved into the frame's parent */
export function unwrapFrames(nodes: PenNode[], ids: string[]): { nodes: PenNode[]; liftedIds: string[] } {
  const unwrapping = new Set(ids);
  const liftedIds: string[] = [];
  const walk = (list: PenNode[]): PenNode[] =>
    list.flatMap((node) => {
      const children = childrenOf(node);
      if (node.type === 'frame' && unwrapping.has(node.id) && children && children.length > 0) {
        liftedIds.push(...children.map((c) => c.id));
        return children.map((c) => offset(c, node.x ?? 0, node.y ?? 0));
      }
      return children ? [{ ...node, children: walk(children) } as PenNode] : [node];
    });
  const result = walk(nodes);
  return { nodes: liftedIds.length > 0 ? result : nodes, liftedIds };
}

const centre = (n: PenNode, axis: 'x' | 'y') =>
  axis === 'x' ? (n.x ?? 0) + (n.width ?? 0) / 2 : (n.y ?? 0) + (n.height ?? 0) / 2;

const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

/**
 * Turns on flex layout, inferring direction, order, gap and padding from where
 * the children are now, and moves the children to the positions that flex
 * layout gives them. The frame keeps its own position and size.
 */
export function arrangeAsFlex(frame: FrameNode): FrameNode {
  const children = frame.children;
  const isRow = children.length === 0 || spread(children.map((c) => centre(c, 'x'))) >= spread(children.map((c) => centre(c, 'y')));
  const main = isRow ? 'x' : 'y';
  const size = isRow ? 'width' : 'height';
  const sorted = [...children].sort((a, b) => (a[main] ?? 0) - (b[main] ?? 0));

  const spaces = sorted
    .slice(1)
    .map((next, i) => Math.max(0, (next[main] ?? 0) - ((sorted[i][main] ?? 0) + (sorted[i][size] ?? 0))));
  const gap = spaces.length > 0 ? Math.round(spaces.reduce((sum, s) => sum + s, 0) / spaces.length) : 0;
  const padding =
    typeof frame.padding === 'number'
      ? frame.padding
      : children.length > 0
        ? Math.max(0, Math.round(Math.min(...children.map((c) => c.x ?? 0), ...children.map((c) => c.y ?? 0))))
        : 0;

  let cursor = padding;
  const placed = sorted.map((child) => {
    const position = isRow ? { x: cursor, y: padding } : { x: padding, y: cursor };
    cursor += (child[size] ?? 0) + gap;
    return { ...child, ...position } as PenNode;
  });

  return {
    ...frame,
    layout: 'flex',
    flexDirection: isRow ? 'row' : 'column',
    gap,
    padding,
    justifyContent: 'start',
    alignItems: 'start',
    children: placed,
  };
}

/** Moves `entries` together so the top-left of their union bounds lands on `target` */
export function placeAt(entries: PenNode[], target: Point): PenNode[] {
  if (entries.length === 0) return entries;
  const bounds = unionBounds(entries);
  return entries.map((n) => offset(n, target.x - bounds.x, target.y - bounds.y));
}

/** Puts `replacements` in the target's slot (same parent, index and top-left), removing the target */
export function replaceNode(nodes: PenNode[], targetId: string, replacements: PenNode[]): PenNode[] | null {
  const parentId = findParentId(nodes, targetId);
  if (parentId === undefined) return null;
  return updateSiblings(nodes, parentId, (list) =>
    list.flatMap((n) => (n.id === targetId ? placeAt(replacements, { x: n.x ?? 0, y: n.y ?? 0 }) : [n]))
  );
}
