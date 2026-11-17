import { describe, it, expect, beforeEach } from 'vitest';
import {
  MIN_ZOOM,
  ZOOM_STEP,
  cloneWithNewIds,
  fitViewportToBounds,
  findParentId,
  isEditableTarget,
  nudgeForKey,
  toolForKey,
  topmostSelected,
  zoomAround,
} from '../../src/lib/canvas-editing';
import { useDesignStore } from '../../src/store/useDesignStore';
import { createTab } from '../../src/store/document-tabs';
import { FrameNode, PenNode } from '../../src/types/pen-ast';

const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

const tree = (): PenNode[] => [
  {
    id: 'f1',
    type: 'frame',
    x: 0,
    y: 0,
    width: 300,
    height: 300,
    children: [
      { id: 'r1', type: 'rect', x: 10, y: 20, width: 50, height: 50 },
      {
        id: 'f2',
        type: 'frame',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        children: [{ id: 't1', type: 'text', x: 0, y: 0, content: 'Hi' }],
      } as FrameNode,
    ],
  } as FrameNode,
  { id: 'r2', type: 'rect', x: 400, y: 0, width: 40, height: 40 },
];

describe('canvas shortcuts', () => {
  it('maps single letters to tools, case-insensitive', () => {
    expect(toolForKey(key('v'))).toBe('select');
    expect(toolForKey(key('F'))).toBe('frame');
    expect(toolForKey(key('r'))).toBe('rect');
    expect(toolForKey(key('o'))).toBe('ellipse');
    expect(toolForKey(key('t'))).toBe('text');
    expect(toolForKey(key('x'))).toBeNull();
  });

  it('leaves modified keys to the browser', () => {
    expect(toolForKey(key('r', { metaKey: true }))).toBeNull();
    expect(toolForKey(key('t', { ctrlKey: true }))).toBeNull();
    expect(toolForKey(key('f', { altKey: true }))).toBeNull();
  });

  it('nudges 1px, or 10px with Shift', () => {
    expect(nudgeForKey(key('ArrowRight'))).toEqual({ dx: 1, dy: 0 });
    expect(nudgeForKey(key('ArrowUp', { shiftKey: true }))).toEqual({ dx: 0, dy: -10 });
    expect(nudgeForKey(key('a'))).toBeNull();
  });

  it('treats form fields and contenteditable as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('zoomAround', () => {
  it('returns to the starting zoom after zooming in then out', () => {
    const start = { x: 40, y: -20, zoom: 1 };
    const pivot = { x: 500, y: 300 };
    const back = zoomAround(zoomAround(start, ZOOM_STEP, pivot), 1 / ZOOM_STEP, pivot);
    expect(back.zoom).toBeCloseTo(1);
    expect(back.x).toBeCloseTo(40);
    expect(back.y).toBeCloseTo(-20);
  });

  it('keeps the canvas point under the pivot fixed', () => {
    const start = { x: 100, y: 50, zoom: 1 };
    const pivot = { x: 300, y: 250 };
    const next = zoomAround(start, 2, pivot);
    // canvas point under the pivot before: (200, 200)
    expect((pivot.x - next.x) / next.zoom).toBeCloseTo(200);
    expect((pivot.y - next.y) / next.zoom).toBeCloseTo(200);
  });

  it('clamps zoom to the supported range', () => {
    expect(zoomAround({ x: 0, y: 0, zoom: 4 }, 10, { x: 0, y: 0 }).zoom).toBe(5);
    expect(zoomAround({ x: 0, y: 0, zoom: 0.1 }, 0.01, { x: 0, y: 0 }).zoom).toBe(0.05);
  });
});

describe('tree helpers', () => {
  it('gives every cloned descendant a new id', () => {
    let n = 0;
    const clone = cloneWithNewIds(tree()[0], () => `new${n++}`) as FrameNode;
    const ids: string[] = [];
    const collect = (node: PenNode) => {
      ids.push(node.id);
      if ('children' in node && node.children) node.children.forEach(collect);
    };
    collect(clone);
    expect(ids).toEqual(['new0', 'new1', 'new2', 'new3']);
    expect((clone.children[1] as FrameNode).children[0]).toMatchObject({ type: 'text', content: 'Hi' });
  });

  it('finds parents, with null for the top level and undefined when missing', () => {
    expect(findParentId(tree(), 't1')).toBe('f2');
    expect(findParentId(tree(), 'r1')).toBe('f1');
    expect(findParentId(tree(), 'r2')).toBeNull();
    expect(findParentId(tree(), 'nope')).toBeUndefined();
  });

  it('drops selected nodes nested inside another selected node', () => {
    expect(topmostSelected(tree(), ['t1', 'f1', 'r2'])).toEqual(['f1', 'r2']);
    expect(topmostSelected(tree(), ['t1', 'r1'])).toEqual(['r1', 't1']);
  });
});

describe('selection editing in the store', () => {
  beforeEach(() => {
    const doc = { version: '2.13', children: tree() };
    const tab = createTab(doc, 'untitled.pen');
    useDesignStore.setState({
      tabs: [tab],
      activeTabId: tab.id,
      document: doc,
      selectedNodeIds: [],
      clipboard: [],
      history: [{ document: doc }],
      historyIndex: 0,
    });
  });

  const node = (id: string) => {
    const find = (nodes: PenNode[]): PenNode | undefined => {
      for (const n of nodes) {
        if (n.id === id) return n;
        if ('children' in n && n.children) {
          const hit = find(n.children);
          if (hit) return hit;
        }
      }
      return undefined;
    };
    return find(useDesignStore.getState().document.children);
  };

  it('moves several nodes as one undo step', () => {
    useDesignStore.getState().moveNodes(['r1', 'r2'], 5, -3);
    expect(node('r1')).toMatchObject({ x: 15, y: 17 });
    expect(node('r2')).toMatchObject({ x: 405, y: -3 });
    expect(useDesignStore.getState().historyIndex).toBe(1);
    useDesignStore.getState().undo();
    expect(node('r1')).toMatchObject({ x: 10, y: 20 });
  });

  it('does not move a child twice when its parent moves too', () => {
    useDesignStore.getState().moveNodes(['f2', 't1'], 10, 0);
    expect(node('f2')).toMatchObject({ x: 110 });
    expect(node('t1')).toMatchObject({ x: 0 });
  });

  it('skips history for a zero move', () => {
    useDesignStore.getState().moveNodes(['r1'], 0, 0);
    expect(useDesignStore.getState().historyIndex).toBe(0);
  });

  it('duplicates beside the original in the same parent, with new ids, and selects the copy', () => {
    useDesignStore.setState({ selectedNodeIds: ['f2'] });
    useDesignStore.getState().duplicateSelection();
    const f1 = node('f1') as FrameNode;
    expect(f1.children).toHaveLength(3);
    const copy = f1.children[2] as FrameNode;
    expect(copy.id).not.toBe('f2');
    expect(copy.children[0].id).not.toBe('t1');
    expect(copy).toMatchObject({ x: 116, y: 116 });
    expect(useDesignStore.getState().selectedNodeIds).toEqual([copy.id]);
  });

  it('copies and pastes with a cascading offset', () => {
    useDesignStore.setState({ selectedNodeIds: ['r2'] });
    const store = useDesignStore.getState();
    store.copySelection();
    store.pasteClipboard();
    useDesignStore.getState().pasteClipboard();
    const top = useDesignStore.getState().document.children;
    expect(top).toHaveLength(4);
    expect(top[2]).toMatchObject({ x: 416, y: 16 });
    expect(top[3]).toMatchObject({ x: 432, y: 32 });
    expect(new Set(top.map((n) => n.id)).size).toBe(4);
  });

  it('pastes at the top level when the source parent is gone', () => {
    useDesignStore.setState({ selectedNodeIds: ['r1'] });
    useDesignStore.getState().copySelection();
    useDesignStore.setState({ selectedNodeIds: ['f1'] });
    useDesignStore.getState().deleteSelectedNodes();
    useDesignStore.getState().pasteClipboard();
    const top = useDesignStore.getState().document.children;
    expect(top.map((n) => n.type)).toEqual(['rect', 'rect']);
  });

  it('selects every top-level node', () => {
    useDesignStore.getState().selectAll();
    expect(useDesignStore.getState().selectedNodeIds).toEqual(['f1', 'r2']);
  });
});

describe('fitViewportToBounds', () => {
  const canvas = { width: 1000, height: 800 };

  it('centres the frame and zooms it to fit inside the padding', () => {
    const v = fitViewportToBounds({ x: 0, y: 2356, width: 1440, height: 905 }, canvas, 50);
    expect(v.zoom).toBeCloseTo(0.625);
    expect(v.x).toBeCloseTo(50);
    expect(v.y).toBeCloseTo((800 - 905 * 0.625) / 2 - 2356 * 0.625);
  });

  it('does not zoom small frames past 100%', () => {
    const v = fitViewportToBounds({ x: 10, y: 20, width: 100, height: 100 }, canvas, 50);
    expect(v).toEqual({ zoom: 1, x: 450 - 10, y: 350 - 20 });
  });

  it('clamps very tall frames to the minimum zoom', () => {
    expect(fitViewportToBounds({ x: 0, y: 0, width: 1440, height: 40000 }, canvas, 50).zoom).toBe(MIN_ZOOM);
  });

  it('stays finite for zero-size frames and tiny canvases', () => {
    const v = fitViewportToBounds({ x: 5, y: 5, width: 0, height: 0 }, { width: 40, height: 0 }, 50);
    expect([v.x, v.y, v.zoom].every(Number.isFinite)).toBe(true);
  });
});
