import { describe, it, expect } from 'vitest';
import {
  arrangeAsFlex,
  placeAt,
  reorderInParent,
  replaceNode,
  unwrapFrames,
  wrapNodes,
} from '../../src/lib/node-ops';
import { FrameNode, PenNode } from '../../src/types/pen-ast';

const rect = (id: string, x = 0, y = 0, width = 40, height = 40): PenNode => ({ id, type: 'rect', x, y, width, height });

const frame = (id: string, children: PenNode[], extra: Partial<FrameNode> = {}): FrameNode => ({
  id,
  type: 'frame',
  x: 0,
  y: 0,
  width: 400,
  height: 400,
  children,
  ...extra,
});

const ids = (nodes: PenNode[]) => nodes.map((n) => n.id);

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as object).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('reorderInParent', () => {
  it('brings two siblings to front keeping their order', () => {
    const nodes = [rect('a'), rect('b'), rect('c'), rect('d')];
    expect(ids(reorderInParent(nodes, ['a', 'c'], 'front'))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sends a nested node to back within its frame', () => {
    const nodes = [frame('f', [rect('w'), rect('x')])];
    const result = reorderInParent(nodes, ['x'], 'back');
    expect((result[0] as FrameNode).children[0].id).toBe('x');
  });
});

describe('wrapNodes', () => {
  it('wraps siblings in a frame at their union bounds', () => {
    const nodes = [rect('a', 10, 20, 50, 50), rect('z', 500, 500), rect('b', 100, 40, 20, 20)];
    const result = wrapNodes(nodes, ['a', 'b'], 'group', 'w')!;
    expect(ids(result)).toEqual(['z', 'w']);
    const wrapper = result[1] as FrameNode;
    expect(wrapper).toMatchObject({ x: 10, y: 20, width: 110, height: 50, name: 'Group', clip: false, layout: 'none' });
    expect(wrapper.fill).toBeUndefined();
    expect(wrapper.children.map((c) => [c.id, c.x, c.y])).toEqual([
      ['a', 0, 0],
      ['b', 90, 20],
    ]);
  });

  it('returns null for nodes with different parents', () => {
    const nodes = [rect('a'), frame('f', [rect('b')])];
    expect(wrapNodes(nodes, ['a', 'b'], 'group', 'w')).toBeNull();
  });

  it('frame kind clips and is named Frame', () => {
    const result = wrapNodes([rect('a'), rect('b', 50)], ['a', 'b'], 'frame', 'w')!;
    expect(result[0]).toMatchObject({ name: 'Frame', clip: true });
  });
});

describe('unwrapFrames', () => {
  it('lifts children into the parent offset by the frame position', () => {
    const nodes = [rect('a'), frame('f', [rect('c', 10, 10)], { x: 100, y: 100 }), rect('b')];
    const { nodes: result, liftedIds } = unwrapFrames(nodes, ['f']);
    expect(ids(result)).toEqual(['a', 'c', 'b']);
    expect(result[1]).toMatchObject({ x: 110, y: 110 });
    expect(liftedIds).toEqual(['c']);
  });

  it('ignores non-frames', () => {
    const nodes = [rect('a'), frame('f', [])];
    const { nodes: result, liftedIds } = unwrapFrames(nodes, ['a', 'f']);
    expect(result).toEqual(nodes);
    expect(liftedIds).toEqual([]);
  });
});

describe('arrangeAsFlex', () => {
  it('infers a row with average gap', () => {
    const result = arrangeAsFlex(frame('f', [rect('a', 20, 20), rect('b', 80, 20), rect('c', 150, 20)]));
    expect(result).toMatchObject({ layout: 'flex', flexDirection: 'row', gap: 25, padding: 20 });
    expect(result.children.map((c) => c.x)).toEqual([20, 85, 150]);
    expect(result.children.map((c) => c.y)).toEqual([20, 20, 20]);
  });

  it('infers a column and sorts by y', () => {
    const result = arrangeAsFlex(frame('f', [rect('c', 10, 200), rect('a', 10, 10), rect('b', 10, 100)]));
    expect(result.flexDirection).toBe('column');
    expect(ids(result.children)).toEqual(['a', 'b', 'c']);
  });

  it('keeps an explicit numeric padding', () => {
    const result = arrangeAsFlex(frame('f', [rect('a', 50, 50), rect('b', 120, 50)], { padding: 8 }));
    expect(result.padding).toBe(8);
    expect(result.children[0]).toMatchObject({ x: 8, y: 8 });
  });
});

describe('placeAt', () => {
  it('moves the group so its top-left lands on the target', () => {
    const result = placeAt([rect('a', 10, 10), rect('b', 30, 50)], { x: 100, y: 200 });
    expect(result.map((n) => [n.x, n.y])).toEqual([
      [100, 200],
      [120, 240],
    ]);
  });
});

describe('replaceNode', () => {
  it('swaps the target for the replacements at its index and position', () => {
    const nodes = [frame('f', [rect('a'), rect('t', 60, 70), rect('b')])];
    const result = replaceNode(nodes, 't', [rect('n', 5, 5)])!;
    const children = (result[0] as FrameNode).children;
    expect(ids(children)).toEqual(['a', 'n', 'b']);
    expect(children[1]).toMatchObject({ x: 60, y: 70 });
  });

  it('returns null for a missing target', () => {
    expect(replaceNode([rect('a')], 'missing', [rect('n')])).toBeNull();
  });
});

describe('node-ops immutability', () => {
  it('does not mutate inputs', () => {
    const nodes = deepFreeze([rect('a', 10, 10), frame('f', [rect('c', 5, 5)], { x: 50, y: 50 }), rect('b', 300, 10)]);
    expect(() => wrapNodes(nodes, ['a', 'b'], 'group', 'w')).not.toThrow();
    expect(() => unwrapFrames(nodes, ['f'])).not.toThrow();
    expect(() => reorderInParent(nodes, ['a'], 'front')).not.toThrow();
  });
});
