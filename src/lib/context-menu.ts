import { FrameNode, PenNode } from '../types/pen-ast';
import { Point } from './node-ops';
import { findParentId, PASTE_OFFSET } from './canvas-editing';
import { findNodeById } from '../core/io/pen-file-handler';
import { isMaster } from './components';

export type ContextAction =
  | 'copy'
  | 'paste-here'
  | 'paste-replace'
  | 'bring-front'
  | 'send-back'
  | 'group'
  | 'frame'
  | 'ungroup'
  | 'add-flex'
  | 'remove-flex'
  | 'create-component'
  | 'detach-instance'
  | 'flip-h'
  | 'flip-v'
  | 'delete';

export interface MenuContext {
  /** False when the right-click landed on empty canvas */
  targetIsNode: boolean;
  /** Topmost selected nodes */
  selection: PenNode[];
  sameParent: boolean;
  hasClipboard: boolean;
}

export interface MenuEntry {
  kind: 'item' | 'submenu' | 'separator';
  action?: ContextAction;
  label: string;
  shortcut?: string;
  enabled: boolean;
  danger?: boolean;
  hint?: string;
}

const COMING_SOON = 'Sắp có';
const SEPARATOR: MenuEntry = { kind: 'separator', label: '', enabled: false };

const item = (action: ContextAction, label: string, enabled: boolean, shortcut?: string): MenuEntry => ({
  kind: 'item',
  action,
  label,
  shortcut,
  enabled,
});

const frameWithChildren = (n: PenNode): n is FrameNode => n.type === 'frame' && n.children.length > 0;

export function buildMenu(ctx: MenuContext): MenuEntry[] {
  const pasteHere = item('paste-here', 'Paste here', ctx.hasClipboard);
  if (!ctx.targetIsNode) return [pasteHere];

  const { selection } = ctx;
  const any = selection.length >= 1;
  const canWrap = any && ctx.sameParent;
  const loneMaster = selection.length === 1 && isMaster(selection[0]);

  return [
    item('copy', 'Copy', any, '⌘C'),
    { kind: 'submenu', label: 'Copy as', enabled: any },
    pasteHere,
    item('paste-replace', 'Paste to replace', ctx.hasClipboard && selection.length === 1, '⌘⇧R'),
    SEPARATOR,
    item('bring-front', 'Bring to Front', any, ']'),
    item('send-back', 'Send to Back', any, '['),
    SEPARATOR,
    item('group', 'Group selection', canWrap, '⌘G'),
    item('frame', 'Frame selection', canWrap, '⌘⌥G'),
    item('ungroup', 'Ungroup', selection.some(frameWithChildren), '⌘⌫'),
    SEPARATOR,
    item('add-flex', 'Add flex layout', selection.some((n) => frameWithChildren(n) && n.layout !== 'flex'), '⇧A'),
    item('remove-flex', 'Remove flex layout', selection.some((n) => n.type === 'frame' && n.layout === 'flex'), '⇧⌥A'),
    SEPARATOR,
    item('create-component', 'Create Component', canWrap && !loneMaster, '⌘⌥K'),
    item('detach-instance', 'Detach instance', selection.some((n) => n.type === 'component'), '⌘⌥B'),
    SEPARATOR,
    item('flip-h', 'Flip horizontal', any, '⇧H'),
    item('flip-v', 'Flip vertical', any, '⇧V'),
    SEPARATOR,
    { ...item('delete', 'Delete', any, '⌫'), danger: true },
    { kind: 'submenu', label: 'Settings', enabled: false, hint: COMING_SOON },
  ];
}

/**
 * Right-clicking inside the selection (the node or any of its ancestors is
 * selected) keeps it; right-clicking elsewhere selects just that node
 */
export function selectionForContextTarget(selectedIds: string[], targetId: string | null, nodes: PenNode[] = []): string[] {
  if (targetId === null) return [];
  const selected = new Set(selectedIds);
  for (let id: string | null | undefined = targetId; id; id = findParentId(nodes, id)) {
    if (selected.has(id)) return selectedIds;
  }
  return [targetId];
}

/** A layer row names its layer exactly, so only a selection that already holds that row survives */
export function selectionForLayerRow(selectedIds: string[], rowId: string): string[] {
  return selectedIds.includes(rowId) ? selectedIds : [rowId];
}

/**
 * "Paste here" for a layer row: inside a frame row, or beside any other row in
 * its parent; undefined when the row is gone
 */
export function layerPasteTarget(nodes: PenNode[], rowId: string): { parentId: string | null; point: Point } | undefined {
  const row = findNodeById(nodes, rowId);
  if (!row) return undefined;
  if (row.type === 'frame') return { parentId: row.id, point: { x: PASTE_OFFSET, y: PASTE_OFFSET } };
  return {
    parentId: findParentId(nodes, rowId) ?? null,
    point: { x: (row.x ?? 0) + PASTE_OFFSET, y: (row.y ?? 0) + PASTE_OFFSET },
  };
}

const MENU_MARGIN = 8;

/** Opens the menu at `point`, flipped left/up when it would overflow, and kept inside the viewport */
export function clampMenuPosition(
  point: Point,
  menu: { width: number; height: number },
  viewport: { width: number; height: number }
): Point {
  const axis = (start: number, size: number, limit: number) => {
    const flipped = start + size > limit - MENU_MARGIN ? start - size : start;
    return Math.max(MENU_MARGIN, Math.min(flipped, limit - size - MENU_MARGIN));
  };
  return { x: axis(point.x, menu.width, viewport.width), y: axis(point.y, menu.height, viewport.height) };
}

export interface ShortcutKey {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** The exact modifiers held, in the order mod, alt, shift, then `code`: e.g. "mod+alt+KeyG" */
const SHORTCUTS: Record<string, ContextAction> = {
  'mod+shift+KeyR': 'paste-replace',
  BracketRight: 'bring-front',
  BracketLeft: 'send-back',
  'mod+KeyG': 'group',
  'mod+alt+KeyG': 'frame',
  'mod+Backspace': 'ungroup',
  'shift+KeyA': 'add-flex',
  'alt+shift+KeyA': 'remove-flex',
  'shift+KeyH': 'flip-h',
  'shift+KeyV': 'flip-v',
  'mod+alt+KeyK': 'create-component',
  'mod+alt+KeyB': 'detach-instance',
};

/**
 * The menu action a key press triggers. Matched on `code`, since Option
 * changes `key` on macOS (⌥G types "©").
 */
export function shortcutForKey(e: ShortcutKey): ContextAction | null {
  const mod = e.metaKey || e.ctrlKey;
  const combo = [mod && 'mod', e.altKey && 'alt', e.shiftKey && 'shift', e.code].filter(Boolean).join('+');
  return SHORTCUTS[combo] ?? null;
}
