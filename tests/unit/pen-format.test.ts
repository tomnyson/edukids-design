import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fromPenFile, toPenFile } from '../../src/core/io/pen-format';
import { deserializePenDocument, findNodeById, updateNodeInTree } from '../../src/core/io/pen-file-handler';
import { ComponentNode, FrameNode, PenDocument, TextNode } from '../../src/types/pen-ast';

const DEMO_PATH = path.resolve(__dirname, '../../docs/demo-pen.pen');
const demoText = () => fs.readFileSync(DEMO_PATH, 'utf-8');

type Json = Record<string, unknown>;

/** Every JSON path whose value differs between a and b */
function diffPaths(a: unknown, b: unknown, at = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as Json), ...Object.keys(b as Json)]);
    return [...keys].flatMap((key) => diffPaths((a as Json)[key], (b as Json)[key], `${at}/${key}`));
  }
  return [at];
}

const penDoc = (children: unknown[], extra: Json = {}) => ({ version: '2.21', children, ...extra });

describe('pen.dev file format: demo-pen.pen', () => {
  it('opens the pen.dev demo file', () => {
    const doc = fromPenFile(JSON.parse(demoText()));
    expect(doc.children).toHaveLength(7);
    const master = findNodeById(doc.children, 'Q2QRHL') as FrameNode;
    expect(master.type).toBe('frame');
    expect(master.reusable).toBe(true);
  });

  it('maps ref nodes to component instances of their master', () => {
    const doc = fromPenFile(JSON.parse(demoText()));
    const instances: ComponentNode[] = [];
    const walk = (nodes: PenDocument['children']) =>
      nodes.forEach((node) => {
        if (node.type === 'component') instances.push(node);
        if ('children' in node && node.children) walk(node.children);
      });
    walk(doc.children);
    expect(instances).toHaveLength(20);
    expect(instances.every((instance) => instance.componentId === 'Q2QRHL' || instance.componentId.length > 0)).toBe(
      true
    );
  });

  it('saves an unchanged pen.dev file back to the same JSON', () => {
    const original = JSON.parse(demoText());
    expect(toPenFile(fromPenFile(original))).toEqual(original);
  });

  it('keeps the key order of the original nodes', () => {
    const original = JSON.parse(demoText());
    expect(JSON.stringify(toPenFile(fromPenFile(original)))).toBe(JSON.stringify(original));
  });

  it('writes back only the field the user changed', () => {
    const original = JSON.parse(demoText());
    const doc = fromPenFile(original);
    const target = original.children[1].children[0];
    const edited: PenDocument = { ...doc, children: updateNodeInTree(doc.children, target.id, { name: 'Renamed' }) };
    expect(diffPaths(original, toPenFile(edited))).toEqual(['/children/1/children/0/name']);
  });

  it('keeps variables, sizing keywords and effects next to an edited field', () => {
    const original = JSON.parse(demoText());
    const doc = fromPenFile(original);
    const edits: [string, Partial<TextNode | FrameNode>, string][] = [
      ['aIPkg', { fontSize: 15 }, '/children/0/children/1/children/1/children/0/children/0/children/1/fontSize'],
      ['G8R2hK', { cornerRadius: 4 }, '/children/2/children/3/cornerRadius'],
    ];
    const children = edits.reduce((nodes, [id, patch]) => updateNodeInTree(nodes, id, patch), doc.children);
    expect(diffPaths(original, toPenFile({ ...doc, children }))).toEqual(edits.map(([, , at]) => at));
  });

  it('opens through the app load path', () => {
    expect(() => deserializePenDocument(demoText())).not.toThrow();
  });
});

describe('pen.dev file format: reading', () => {
  it('treats a frame without layout as a horizontal flex row', () => {
    const doc = fromPenFile(penDoc([{ id: 'f', type: 'frame', children: [] }]));
    expect(doc.children[0]).toMatchObject({ layout: 'flex', flexDirection: 'row' });
  });

  it('maps vertical and none layouts', () => {
    const doc = fromPenFile(
      penDoc([
        { id: 'v', type: 'frame', layout: 'vertical', justifyContent: 'space_between' },
        { id: 'n', type: 'frame', layout: 'none' },
      ])
    );
    expect(doc.children[0]).toMatchObject({ layout: 'flex', flexDirection: 'column', justifyContent: 'between' });
    expect(doc.children[1]).toMatchObject({ layout: 'none' });
  });

  it('reads sizing keywords and their fallback', () => {
    const doc = fromPenFile(
      penDoc([{ id: 'f', type: 'frame', width: 'fill_container', height: 'fit_content(100)', children: [] }])
    );
    const frame = doc.children[0];
    expect(frame).toMatchObject({ widthSizing: 'fill_container', heightSizing: 'fit_content', height: 100 });
    expect(frame.width).toBeUndefined();
  });

  it('resolves variables and maps enabled to visible', () => {
    const doc = fromPenFile(
      penDoc([{ id: 't', type: 'text', content: '$ink', fill: '$ink', enabled: false }], {
        variables: { ink: { type: 'color', value: '#0F1B2D' } },
      })
    );
    const text = doc.children[0] as TextNode;
    expect(text).toMatchObject({ fill: '#0F1B2D', visible: false, content: '$ink' });
  });

  it('reads per-side stroke widths and four corner radii', () => {
    const doc = fromPenFile(
      penDoc([{ id: 'r', type: 'rectangle', strokeWidth: { bottom: 1 }, cornerRadius: [4, 4, 0, 0] }])
    );
    expect(doc.children[0]).toMatchObject({
      type: 'rect',
      strokeWidths: { bottom: 1 },
      cornerRadii: [4, 4, 0, 0],
    });
  });

  it('turns a gradient fill into a CSS paint', () => {
    const doc = fromPenFile(
      penDoc([
        {
          id: 'r',
          type: 'rectangle',
          fill: {
            type: 'gradient',
            gradientType: 'linear',
            rotation: 270,
            colors: [
              { color: '#000000', position: 0 },
              { color: '#ffffff', position: 1 },
            ],
          },
        },
      ])
    );
    expect(doc.children[0].fill).toBe('linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  });

  it('reads a ref with its descendants overrides', () => {
    const doc = fromPenFile(
      penDoc([
        { id: 'm', type: 'frame', reusable: true, children: [{ id: 'label', type: 'text', content: 'A' }] },
        { id: 'i', type: 'ref', ref: 'm', x: 10, y: 20, descendants: { label: { content: 'B', enabled: false } } },
      ])
    );
    expect(doc.children[1]).toMatchObject({
      type: 'component',
      componentId: 'm',
      descendants: { label: { content: 'B', visible: false } },
    });
  });

  it('reads an icon node', () => {
    const doc = fromPenFile(penDoc([{ id: 'ic', type: 'icon', library: 'lucide', icon: 'globe', width: 14 }]));
    expect(doc.children[0]).toMatchObject({ type: 'icon', library: 'lucide', icon: 'globe', width: 14 });
  });

  it('keeps legacy app files: a frame without layout stays absolute', () => {
    const doc = fromPenFile({ version: '2.13', children: [{ id: 'f', type: 'frame', x: 0, y: 0, children: [] }] });
    expect((doc.children[0] as FrameNode).layout).toBeUndefined();
  });

  it('rejects input that is not a document', () => {
    expect(() => fromPenFile('nope')).toThrow(/\.pen/);
    expect(() => fromPenFile(penDoc([{ type: 'frame' }]))).toThrow(/id/);
  });
});

describe('pen.dev file format: writing nodes made in the app', () => {
  const write = (children: PenDocument['children']) => toPenFile({ version: '2.21', children }).children as Json[];

  it('uses pen.dev type names and layout words', () => {
    const [frame] = write([
      {
        id: 'f',
        type: 'frame',
        layout: 'flex',
        flexDirection: 'column',
        justifyContent: 'between',
        children: [
          { id: 'r', type: 'rect', x: 0, y: 0, width: 10, height: 10, visible: false },
          { id: 'c', type: 'component', componentId: 'f' },
        ],
      },
    ]);
    expect(frame).toMatchObject({ type: 'frame', layout: 'vertical', justifyContent: 'space_between' });
    const [rect, instance] = frame.children as Json[];
    expect(rect).toMatchObject({ type: 'rectangle', enabled: false });
    expect(rect).not.toHaveProperty('visible');
    expect(instance).toEqual({ id: 'c', type: 'ref', ref: 'f' });
  });

  it('writes layout none for an absolute frame', () => {
    const [frame] = write([{ id: 'f', type: 'frame', x: 0, y: 0, width: 100, height: 100, children: [] }]);
    expect(frame.layout).toBe('none');
  });

  it('writes an image node as a rectangle with an image fill', () => {
    const [image] = write([
      { id: 'im', type: 'image', x: 0, y: 0, width: 10, height: 10, src: 'https://e.x/a.png', fit: 'contain' },
    ]);
    expect(image).toMatchObject({
      type: 'rectangle',
      fill: { type: 'image', url: 'https://e.x/a.png', mode: 'contain' },
    });
    expect(image).not.toHaveProperty('src');
  });

  it('fixes the text box of a sized text so pen.dev keeps its width', () => {
    const [text] = write([{ id: 't', type: 'text', content: 'Hi', x: 0, y: 0, width: 80, height: 20 }]);
    expect(text.textGrowth).toBe('fixed-width-height');
  });

  it('round-trips a node the app made', () => {
    const children: PenDocument['children'] = [
      { id: 'r', type: 'rect', name: 'Box', x: 5, y: 6, width: 10, height: 20, fill: '#ff0000' },
    ];
    const doc = fromPenFile(toPenFile({ version: '2.21', children }));
    expect(doc.children[0]).toMatchObject(children[0]);
  });
});
