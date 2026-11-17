import { describe, it, expect } from 'vitest';
import {
  createInstance,
  detachOrphans,
  expandInstances,
  findMaster,
  instancesFit,
  isMaster,
  listMasters,
  resolveInstance,
  wouldNest,
} from '../../src/lib/components';
import { cloneWithNewIds } from '../../src/lib/canvas-editing';
import { ComponentNode, FrameNode, PenNode } from '../../src/types/pen-ast';

const rect = (id: string, x = 0, y = 0): PenNode => ({ id, type: 'rect', x, y, width: 10, height: 10, fill: '#ef4444' });
const frame = (id: string, children: PenNode[], extra: Partial<FrameNode> = {}): FrameNode => ({
  id,
  type: 'frame',
  name: id,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  children,
  ...extra,
});
const instance = (id: string, componentId: string, extra: Partial<ComponentNode> = {}): ComponentNode => ({
  id,
  type: 'component',
  componentId,
  x: 0,
  y: 0,
  width: 200,
  height: 100,
  ...extra,
});

const button = frame('btn', [rect('label', 4, 6)], { reusable: true, name: 'Button', fill: '#111111' });

describe('isMaster / listMasters / findMaster', () => {
  it('treats only frames marked reusable as masters', () => {
    expect(isMaster(button)).toBe(true);
    expect(isMaster(frame('plain', []))).toBe(false);
    expect(isMaster({ ...rect('r'), reusable: true } as PenNode)).toBe(false);
  });

  it('lists masters at any depth, in tree order', () => {
    const nested = frame('card', [], { reusable: true });
    const nodes = [button, frame('page', [nested, rect('x')]), rect('y')];
    expect(listMasters(nodes).map((n) => n.id)).toEqual(['btn', 'card']);
  });

  it('finds a master by id and ignores plain frames with that id', () => {
    expect(findMaster([frame('page', [button])], 'btn')?.id).toBe('btn');
    expect(findMaster([frame('page', [])], 'page')).toBeUndefined();
  });
});

describe('createInstance', () => {
  it('copies size and name from the master and points at it', () => {
    expect(createInstance(button, 'i1', { x: 30, y: 40 })).toEqual({
      id: 'i1',
      type: 'component',
      name: 'Button',
      componentId: 'btn',
      x: 30,
      y: 40,
      width: 200,
      height: 100,
    });
  });
});

describe('resolveInstance', () => {
  it('renders the master content at the instance position with prefixed child ids', () => {
    const inst = instance('i1', 'btn', { x: 300, y: 50, name: 'Buy' });
    const resolved = resolveInstance(inst, [button, inst])!;
    expect(resolved).toMatchObject({ id: 'i1', type: 'frame', name: 'Buy', x: 300, y: 50, fill: '#111111' });
    expect(resolved.reusable).toBeUndefined();
    expect(resolved.children.map((c) => c.id)).toEqual(['i1-label']);
    expect(resolved.children[0]).toMatchObject({ x: 4, y: 6, fill: '#ef4444' });
  });

  it('follows edits to the master', () => {
    const edited = { ...button, fill: '#00ff00' };
    expect(resolveInstance(instance('i1', 'btn'), [edited])!.fill).toBe('#00ff00');
  });

  it('is null when the master is gone', () => {
    expect(resolveInstance(instance('i1', 'missing'), [button])).toBeNull();
  });

  it('expands instances nested in the master', () => {
    const card = frame('card', [instance('inner', 'btn', { x: 8, y: 8 })], { reusable: true });
    const resolved = resolveInstance(instance('i1', 'card'), [button, card])!;
    const inner = resolved.children[0] as FrameNode;
    expect(inner).toMatchObject({ id: 'i1-inner', type: 'frame', x: 8, y: 8 });
    expect(inner.children.map((c) => c.id)).toEqual(['i1-inner-label']);
  });

  it('lets every field the instance sets win over the master', () => {
    const inst = instance('i1', 'btn', { fill: '#222222', cornerRadius: 4, opacity: 0.5 });
    expect(resolveInstance(inst, [button])).toMatchObject({ fill: '#222222', cornerRadius: 4, opacity: 0.5 });
  });

  it('drops the master sizing keyword when the instance sets a size', () => {
    const wide = frame('wide', [], { reusable: true, widthSizing: 'fill_container', width: undefined });
    const resolved = resolveInstance(instance('i1', 'wide', { width: 46 }), [wide])!;
    expect(resolved.width).toBe(46);
    expect(resolved.widthSizing).toBeUndefined();
  });

  it('drops a per-side stroke when a descendant patch sets one stroke width', () => {
    const lined = frame('lined', [{ ...rect('r'), strokeWidths: { bottom: 1 } }], { reusable: true });
    const inst = instance('i1', 'lined', { descendants: { r: { strokeWidth: 2 } } });
    const [r] = resolveInstance(inst, [lined])!.children;
    expect(r).toMatchObject({ strokeWidth: 2 });
    expect(r.strokeWidths).toBeUndefined();
  });

  it('patches a descendant by id', () => {
    const inst = instance('i1', 'btn', { descendants: { label: { fill: '#0000ff', visible: false } } });
    const [label] = resolveInstance(inst, [button])!.children;
    expect(label).toMatchObject({ id: 'i1-label', fill: '#0000ff', visible: false, x: 4 });
  });

  it('patches a descendant by its name', () => {
    const named = frame('tag', [{ ...rect('t1'), name: 'Dot' }], { reusable: true });
    const inst = instance('i1', 'tag', { descendants: { Dot: { fill: '#00ffff' } } });
    expect(resolveInstance(inst, [named])!.children[0].fill).toBe('#00ffff');
  });

  it('replaces a descendant when the patch has a type', () => {
    const inst = instance('i1', 'btn', { descendants: { label: { type: 'text', content: 'Hi' } as never } });
    const [label] = resolveInstance(inst, [button])!.children;
    expect(label).toMatchObject({ id: 'i1-label', type: 'text', content: 'Hi' });
    expect(label.fill).toBeUndefined();
  });

  it('reaches into nested instances with an id path', () => {
    const card = frame('card', [instance('inner', 'btn')], { reusable: true });
    const inst = instance('i1', 'card', { descendants: { 'inner/label': { fill: '#00ff00' } } });
    const inner = resolveInstance(inst, [button, card])!.children[0] as FrameNode;
    expect(inner.children[0]).toMatchObject({ id: 'i1-inner-label', fill: '#00ff00' });
  });

  it('drops a self-referencing instance instead of recursing forever', () => {
    const loop = frame('loop', [instance('self', 'loop'), rect('r')], { reusable: true });
    const resolved = resolveInstance(instance('i1', 'loop'), [loop])!;
    expect(resolved.children.map((c) => c.id)).toEqual(['i1-r']);
  });
});

describe('expandInstances', () => {
  it('replaces every instance in the tree and leaves other nodes alone', () => {
    const page = frame('page', [instance('i1', 'btn', { x: 20 }), rect('r')]);
    const [expandedPage] = expandInstances([page], [button, page]) as FrameNode[];
    expect(expandedPage.children[0]).toMatchObject({ id: 'i1', type: 'frame', x: 20 });
    expect(expandedPage.children[1]).toBe(page.children[1]);
  });

  it('drops instances whose master is missing', () => {
    expect(expandInstances([instance('i1', 'missing'), rect('r')], [])).toEqual([rect('r')]);
  });
});

describe('detachOrphans', () => {
  let n = 0;
  const makeId = () => `new${++n}`;

  it('turns instances of a deleted master into plain frames with the master content', () => {
    const inst = instance('i1', 'btn', { x: 300 });
    const before = [button, inst];
    const after = detachOrphans(before, [inst], makeId);
    const detached = after[0] as FrameNode;
    expect(detached).toMatchObject({ id: 'i1', type: 'frame', x: 300, fill: '#111111' });
    expect(detached.reusable).toBeUndefined();
    expect(detached.children).toHaveLength(1);
    expect(detached.children[0].id).toMatch(/^new\d+$/);
  });

  it('returns the same array when every instance still has its master', () => {
    const nodes = [button, instance('i1', 'btn')];
    expect(detachOrphans(nodes, nodes, makeId)).toBe(nodes);
  });

  it('detaches orphans nested inside frames', () => {
    const page = frame('page', [instance('i1', 'btn')]);
    const after = detachOrphans([button, page], [page], makeId);
    expect((after[0] as FrameNode).children[0].type).toBe('frame');
  });

  it('leaves an instance alone when it never had a master', () => {
    const stray = instance('i1', 'missing');
    expect(detachOrphans([stray], [stray], makeId)).toEqual([stray]);
  });
});

describe('wouldNest', () => {
  it('blocks putting an instance inside its own master or a child of it', () => {
    const master = frame('m', [frame('inner', [])], { reusable: true });
    expect(wouldNest([master], 'm', 'm')).toBe(true);
    expect(wouldNest([master], 'm', 'inner')).toBe(true);
  });

  it('blocks an indirect loop through another master', () => {
    const a = frame('a', [instance('ib', 'b')], { reusable: true });
    const b = frame('b', [], { reusable: true });
    expect(wouldNest([a, b], 'a', 'b')).toBe(true);
  });

  it('allows any other frame', () => {
    expect(wouldNest([button, frame('page', [])], 'btn', 'page')).toBe(false);
    expect(wouldNest([button], 'btn', null)).toBe(false);
  });
});

describe('instancesFit', () => {
  const page = frame('page', []);

  it('accepts nodes whose instances all have a master and do not nest', () => {
    expect(instancesFit(frame('box', [instance('i', 'btn')]), [button, page], 'page')).toBe(true);
    expect(instancesFit(rect('r'), [], null)).toBe(true);
  });

  it('rejects an instance whose master is not in the document', () => {
    expect(instancesFit(frame('box', [instance('i', 'btn')]), [page], 'page')).toBe(false);
  });

  it('rejects an instance placed inside its own master', () => {
    expect(instancesFit(instance('i', 'btn'), [button], 'btn')).toBe(false);
  });
});

describe('cloneWithNewIds', () => {
  it('turns a copied master into a plain frame', () => {
    const copy = cloneWithNewIds(button, () => 'c') as FrameNode;
    expect(copy.reusable).toBeUndefined();
  });
});
