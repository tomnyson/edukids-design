import { describe, it, expect } from 'vitest';
import { buildMenu, clampMenuPosition, MenuContext, MenuEntry, selectionForContextTarget, selectionForLayerRow, layerPasteTarget, shortcutForKey } from '../../src/lib/context-menu';
import { FrameNode, PenNode } from '../../src/types/pen-ast';

const rect = (id: string): PenNode => ({ id, type: 'rect', x: 0, y: 0, width: 10, height: 10 });
const frame = (id: string, children: PenNode[], extra: Partial<FrameNode> = {}): FrameNode => ({
  id,
  type: 'frame',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  children,
  ...extra,
});

const ctx = (extra: Partial<MenuContext> = {}): MenuContext => ({
  targetIsNode: true,
  selection: [rect('a')],
  sameParent: true,
  hasClipboard: true,
  ...extra,
});

const entry = (menu: MenuEntry[], label: string) => menu.find((e) => e.label === label)!;

describe('buildMenu', () => {
  it('empty canvas menu only offers paste here', () => {
    const menu = buildMenu(ctx({ targetIsNode: false, selection: [] }));
    expect(menu).toHaveLength(1);
    expect(menu[0]).toMatchObject({ kind: 'item', action: 'paste-here', enabled: true });
  });

  it('full menu lists the 17 entries in screenshot order with shortcut labels', () => {
    const items = buildMenu(ctx()).filter((e) => e.kind !== 'separator');
    expect(items.map((e) => [e.label, e.shortcut])).toEqual([
      ['Copy', '⌘C'],
      ['Copy as', undefined],
      ['Paste here', undefined],
      ['Paste to replace', '⌘⇧R'],
      ['Bring to Front', ']'],
      ['Send to Back', '['],
      ['Group selection', '⌘G'],
      ['Frame selection', '⌘⌥G'],
      ['Ungroup', '⌘⌫'],
      ['Add flex layout', '⇧A'],
      ['Remove flex layout', '⇧⌥A'],
      ['Create Component', '⌘⌥K'],
      ['Detach instance', '⌘⌥B'],
      ['Flip horizontal', '⇧H'],
      ['Flip vertical', '⇧V'],
      ['Delete', '⌫'],
      ['Settings', undefined],
    ]);
    expect(entry(items, 'Delete').danger).toBe(true);
  });

  it('places separators after the screenshot groups', () => {
    const menu = buildMenu(ctx());
    const before = menu.flatMap((e, i) => (e.kind === 'separator' ? [menu[i - 1].label] : []));
    expect(before).toEqual(['Paste to replace', 'Send to Back', 'Ungroup', 'Remove flex layout', 'Detach instance', 'Flip vertical']);
  });

  it('group is disabled across parents', () => {
    const menu = buildMenu(ctx({ selection: [rect('a'), rect('b')], sameParent: false }));
    expect(entry(menu, 'Group selection').enabled).toBe(false);
    expect(entry(menu, 'Frame selection').enabled).toBe(false);
  });

  it('ungroup is enabled only for frames with children', () => {
    expect(entry(buildMenu(ctx({ selection: [frame('f', [rect('c')])] })), 'Ungroup').enabled).toBe(true);
    expect(entry(buildMenu(ctx({ selection: [frame('f', [])] })), 'Ungroup').enabled).toBe(false);
    expect(entry(buildMenu(ctx({ selection: [rect('a')] })), 'Ungroup').enabled).toBe(false);
  });

  it('add flex disabled for an already flex frame; remove flex enabled', () => {
    const menu = buildMenu(ctx({ selection: [frame('f', [rect('c')], { layout: 'flex' })] }));
    expect(entry(menu, 'Add flex layout').enabled).toBe(false);
    expect(entry(menu, 'Remove flex layout').enabled).toBe(true);
  });

  it('paste to replace needs exactly one selected node and a clipboard', () => {
    expect(entry(buildMenu(ctx()), 'Paste to replace').enabled).toBe(true);
    expect(entry(buildMenu(ctx({ hasClipboard: false })), 'Paste to replace').enabled).toBe(false);
    expect(entry(buildMenu(ctx({ selection: [rect('a'), rect('b')] })), 'Paste to replace').enabled).toBe(false);
  });

  it('settings is disabled with a hint', () => {
    expect(entry(buildMenu(ctx()), 'Settings')).toMatchObject({ enabled: false, hint: 'Sắp có' });
  });

  it('create component works on any selection except a lone master or across parents', () => {
    const created = entry(buildMenu(ctx()), 'Create Component');
    expect(created.enabled).toBe(true);
    expect(created.hint).toBeUndefined();
    expect(entry(buildMenu(ctx({ selection: [frame('f', [])] })), 'Create Component').enabled).toBe(true);
    expect(entry(buildMenu(ctx({ selection: [frame('m', [], { reusable: true })] })), 'Create Component').enabled).toBe(false);
    expect(entry(buildMenu(ctx({ selection: [rect('a'), rect('b')], sameParent: false })), 'Create Component').enabled).toBe(false);
  });

  it('detach instance needs an instance in the selection', () => {
    const inst: PenNode = { id: 'i', type: 'component', componentId: 'm', x: 0, y: 0 };
    expect(entry(buildMenu(ctx()), 'Detach instance').enabled).toBe(false);
    expect(entry(buildMenu(ctx({ selection: [rect('a'), inst] })), 'Detach instance').enabled).toBe(true);
  });
});

describe('selectionForContextTarget', () => {
  it('selectionForContextTarget keeps a multi-selection containing the target', () => {
    expect(selectionForContextTarget(['a', 'b'], 'b')).toEqual(['a', 'b']);
    expect(selectionForContextTarget(['a', 'b'], 'c')).toEqual(['c']);
    expect(selectionForContextTarget(['a'], null)).toEqual([]);
  });

  it('keeps a selected group when right-clicking one of its children', () => {
    const nodes = [frame('g', [frame('inner', [rect('c')])]), rect('z')];
    expect(selectionForContextTarget(['g'], 'c', nodes)).toEqual(['g']);
    expect(selectionForContextTarget(['z'], 'c', nodes)).toEqual(['c']);
  });
});

describe('clampMenuPosition', () => {
  it('clampMenuPosition keeps the menu on screen', () => {
    const point = clampMenuPosition({ x: 990, y: 700 }, { width: 220, height: 400 }, { width: 1000, height: 800 });
    expect(point.x).toBeLessThanOrEqual(772);
    expect(point.y).toBeLessThanOrEqual(392);
    expect(point.x).toBeGreaterThanOrEqual(8);
    expect(point.y).toBeGreaterThanOrEqual(8);
  });

  it('leaves a menu that fits where the pointer is', () => {
    expect(clampMenuPosition({ x: 100, y: 120 }, { width: 220, height: 400 }, { width: 1000, height: 800 })).toEqual({ x: 100, y: 120 });
  });
});

describe('shortcutForKey', () => {
  const key = (code: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}, k = '') => ({
    code,
    key: k,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });

  it('maps every shortcut', () => {
    expect(shortcutForKey(key('KeyR', { metaKey: true, shiftKey: true }))).toBe('paste-replace');
    expect(shortcutForKey(key('BracketRight'))).toBe('bring-front');
    expect(shortcutForKey(key('BracketLeft'))).toBe('send-back');
    expect(shortcutForKey(key('KeyG', { metaKey: true }))).toBe('group');
    expect(shortcutForKey(key('KeyG', { metaKey: true, altKey: true }))).toBe('frame');
    expect(shortcutForKey(key('Backspace', { metaKey: true }))).toBe('ungroup');
    expect(shortcutForKey(key('KeyA', { shiftKey: true }))).toBe('add-flex');
    expect(shortcutForKey(key('KeyA', { shiftKey: true, altKey: true }))).toBe('remove-flex');
    expect(shortcutForKey(key('KeyH', { shiftKey: true }))).toBe('flip-h');
    expect(shortcutForKey(key('KeyV', { shiftKey: true }))).toBe('flip-v');
    expect(shortcutForKey(key('KeyK', { metaKey: true, altKey: true }))).toBe('create-component');
    expect(shortcutForKey(key('KeyB', { metaKey: true, altKey: true }))).toBe('detach-instance');
    expect(shortcutForKey(key('KeyG', { ctrlKey: true }))).toBe('group');
  });

  it('matches option letters by code on macOS', () => {
    expect(shortcutForKey(key('KeyG', { metaKey: true, altKey: true }, '©'))).toBe('frame');
  });

  it('bare backspace is not ungroup', () => {
    expect(shortcutForKey(key('Backspace'))).toBeNull();
  });

  it('does not steal redo or plain letters', () => {
    expect(shortcutForKey(key('KeyZ', { metaKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutForKey(key('KeyA'))).toBeNull();
    expect(shortcutForKey(key('KeyA', { metaKey: true }))).toBeNull();
    expect(shortcutForKey(key('KeyV', { metaKey: true }))).toBeNull();
    expect(shortcutForKey(key('KeyR', { metaKey: true }))).toBeNull();
  });
});

describe('selectionForLayerRow', () => {
  it('keeps a multi-selection that includes the row', () => {
    const selected = ['a', 'b'];
    expect(selectionForLayerRow(selected, 'b')).toBe(selected);
  });

  it('selects only the row when its parent is the selected layer', () => {
    expect(selectionForLayerRow(['g'], 'c')).toEqual(['c']);
  });
});

describe('layerPasteTarget', () => {
  const tree: PenNode[] = [
    { id: 'F', type: 'frame', x: 0, y: 0, width: 400, height: 300, children: [{ id: 'c', type: 'rect', x: 40, y: 50, width: 10, height: 10 }] },
    { id: 'r', type: 'rect', x: 500, y: 20, width: 80, height: 80 },
  ];

  it('pastes inside a frame row, near its top-left', () => {
    expect(layerPasteTarget(tree, 'F')).toEqual({ parentId: 'F', point: { x: 16, y: 16 } });
  });

  it('pastes next to a top-level layer row, in the same parent', () => {
    expect(layerPasteTarget(tree, 'r')).toEqual({ parentId: null, point: { x: 516, y: 36 } });
  });

  it('pastes next to a nested layer row, inside its parent', () => {
    expect(layerPasteTarget(tree, 'c')).toEqual({ parentId: 'F', point: { x: 56, y: 66 } });
  });

  it('is undefined for a row that is not in the tree', () => {
    expect(layerPasteTarget(tree, 'missing')).toBeUndefined();
  });
});
