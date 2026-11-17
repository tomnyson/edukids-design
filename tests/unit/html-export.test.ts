import { describe, it, expect } from 'vitest';
import {
  buildHtmlDocument,
  buildHtmlExport,
  canvasRoot,
  findTopLevelId,
  renderNodeHtml,
  resolveExportTarget,
} from '../../src/compiler/ast-to-html';
import { FrameNode, PenDocument } from '../../src/types/pen-ast';
import { fromPenFile } from '../../src/core/io/pen-format';

const landing: FrameNode = {
  id: 'root',
  type: 'frame',
  name: 'Landing',
  x: 400,
  y: 120,
  width: 1280,
  height: 800,
  fill: '#0b0c10',
  children: [
    {
      id: 'hero',
      type: 'frame',
      name: 'Hero',
      x: 40,
      y: 60,
      width: 600,
      height: 300,
      cornerRadius: 12,
      children: [
        {
          id: 'title',
          type: 'text',
          x: 24,
          y: 32,
          width: 500,
          height: 48,
          content: 'Bánh <ngon> & "tươi"',
          fontSize: 40,
        },
      ],
    },
    { id: 'line', type: 'rect', x: 0, y: 780, width: 1280, height: 20, fill: '#f97316' },
  ],
};

const doc: PenDocument = {
  version: '2.13',
  children: [
    landing,
    { id: 'pricing', type: 'frame', name: 'Pricing', x: 1800, y: 120, width: 400, height: 300, children: [] },
  ],
};

describe('renderNodeHtml', () => {
  it('positions children absolutely like the canvas does', () => {
    const html = renderNodeHtml(landing, true);
    expect(html).toContain('left:40px;top:60px;width:600px;height:300px');
    expect(html).toContain('left:24px;top:32px');
    expect(html).toContain('background-color:#f97316');
  });

  it('pins the root frame at the origin regardless of its canvas position', () => {
    const html = renderNodeHtml(landing, true);
    expect(html).not.toContain('left:400px');
    expect(html).toMatch(/^<div style="position:relative;left:0px;top:0px;width:1280px;height:800px/);
  });

  it('escapes text content', () => {
    const html = renderNodeHtml(landing, true);
    expect(html).toContain('Bánh &lt;ngon&gt; &amp; &quot;tươi&quot;');
    expect(html).not.toContain('<ngon>');
  });

  it('drops style values that could break out of the attribute or inject CSS', () => {
    const evil: FrameNode = {
      id: 'x',
      type: 'frame',
      width: 10,
      height: 10,
      fill: 'red;background-image:url(https://evil.test)',
      stroke: '"><script>alert(1)</script>',
      children: [],
    };
    const html = renderNodeHtml(evil, true);
    expect(html).not.toContain('evil.test');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('background-color:red');
  });

  it('skips hidden nodes', () => {
    const html = renderNodeHtml({ ...landing, children: [{ ...landing.children[1], visible: false }] }, true);
    expect(html).not.toContain('#f97316');
  });
});

describe('buildHtmlDocument', () => {
  it('produces a standalone page titled after the node', () => {
    const page = buildHtmlDocument(landing);
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(page).toContain('<meta charset="utf-8">');
    expect(page).toContain('<title>Landing</title>');
    expect(page).not.toContain('<script');
  });
});

describe('canvasRoot', () => {
  it('wraps every top-level node in a frame sized to their bounding box', () => {
    const root = canvasRoot(doc.children, 'landing');
    expect(root.width).toBe(2200 - 400);
    expect(root.height).toBe(800);
    expect(root.children.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [1400, 0],
    ]);
  });
});

describe('findTopLevelId', () => {
  it('maps a nested selection to its top-level frame', () => {
    expect(findTopLevelId(doc.children, 'title')).toBe('root');
    expect(findTopLevelId(doc.children, 'pricing')).toBe('pricing');
    expect(findTopLevelId(doc.children, 'missing')).toBeNull();
  });
});

describe('buildHtmlExport', () => {
  it('returns null for an empty canvas', () => {
    expect(buildHtmlExport({ version: '2.13', children: [] }, [], 'untitled.pen')).toBeNull();
  });

  it('exports the selected node under its own name', () => {
    const result = buildHtmlExport(doc, ['hero'], 'landing.pen');
    expect(result?.filename).toBe('Hero.html');
    expect(result?.content).toContain('Bánh');
    expect(result?.content).not.toContain('#f97316');
  });

  it('exports the whole canvas when nothing is selected', () => {
    const result = buildHtmlExport(doc, [], 'landing.pen');
    expect(result?.filename).toBe('landing.html');
    expect(result?.content).toContain('#f97316');
  });
});

describe('image nodes', () => {
  it('renders an <img> with escaped source, alt and object-fit', () => {
    const html = renderNodeHtml(
      {
        id: 'i',
        type: 'image',
        name: 'Logo "A"',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        src: 'https://cdn.test/a.png?x=1&y=2',
        fit: 'contain',
      },
      false
    );
    expect(html).toContain('<img src="https://cdn.test/a.png?x=1&amp;y=2" alt="Logo &quot;A&quot;"');
    expect(html).toContain('left:10px;top:20px;width:100px;height:50px');
    expect(html).toContain('object-fit:contain');
  });

  it('falls back to a placeholder box for unsafe sources', () => {
    const html = renderNodeHtml({ id: 'i', type: 'image', width: 10, height: 10, src: 'javascript:alert(1)' }, true);
    expect(html).not.toContain('javascript');
    expect(html).not.toContain('<img');
    expect(html).toContain('background-color:#27272a');
  });
});

describe('flip rendering', () => {
  it('renders flip combined with rotation', () => {
    const html = renderNodeHtml(
      { id: 'r', type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 45, flipX: true },
      false
    );
    expect(html).toContain('transform:rotate(45deg) scale(-1, 1)');
  });
});

describe('component instances', () => {
  const master: FrameNode = {
    id: 'btn',
    type: 'frame',
    name: 'Button',
    reusable: true,
    x: 0,
    y: 0,
    width: 120,
    height: 40,
    fill: '#7c3aed',
    children: [{ id: 'lbl', type: 'text', x: 8, y: 8, width: 100, height: 20, content: 'Mua ngay' }],
  };
  const page: FrameNode = {
    id: 'page',
    type: 'frame',
    name: 'Page',
    x: 400,
    y: 0,
    width: 600,
    height: 400,
    children: [{ id: 'inst', type: 'component', componentId: 'btn', x: 20, y: 30, width: 120, height: 40 }],
  };
  const withInstance: PenDocument = { version: '2.13', children: [master, page] };

  it('exports an instance with its master content', () => {
    const content = buildHtmlExport(withInstance, ['page'], 'x.pen')?.content ?? '';
    expect(content).toContain('#7c3aed');
    expect(content).toContain('Mua ngay');
  });

  it('expands an instance that is itself the export target', () => {
    expect(resolveExportTarget(withInstance, ['inst'], 'x.pen')?.root).toMatchObject({
      type: 'frame',
      fill: '#7c3aed',
    });
  });
});

describe('pen.dev layout', () => {
  const page = fromPenFile({
    version: '2.21',
    children: [
      {
        id: 'landing',
        type: 'frame',
        name: 'Landing',
        x: 300,
        y: 200,
        width: 1200,
        layout: 'vertical',
        gap: 24,
        padding: 40,
        fill: '#f4ede4',
        children: [
          {
            id: 'nav',
            type: 'frame',
            gap: 20,
            children: [
              { id: 'gift', type: 'text', content: 'Gift cards', fontFamily: 'Inter', fontSize: 14 },
              { id: 'lang', type: 'text', content: 'PT / EN', fontFamily: 'Inter', fontSize: 14 },
            ],
          },
          {
            id: 'pill',
            type: 'frame',
            width: 160,
            height: 48,
            justifyContent: 'center',
            alignItems: 'center',
            cornerRadius: 24,
            children: [{ id: 'cta', type: 'text', content: 'Book a class', fontFamily: 'Fraunces' }],
          },
          {
            id: 'para',
            type: 'text',
            width: 'fill_container',
            textGrowth: 'fixed-width',
            content: 'Six people at a time, in a sunlit studio.',
          },
          { id: 'ico', type: 'icon', library: 'lucide', icon: 'globe', width: 16, height: 16 },
        ],
      },
    ],
  }).children[0];

  const html = renderNodeHtml(page, true);
  /** The style attribute of the element whose text or style contains `marker` */
  const styleOf = (marker: string) => {
    const at = html.indexOf(marker);
    const open = html.lastIndexOf('style="', at);
    return html.slice(open, html.indexOf('"', open + 'style="'.length));
  };

  it('lays out flex frames like the canvas', () => {
    const column = styleOf('flex-direction:column');
    ['display:flex', 'gap:24px', 'padding:40px'].forEach((rule) => expect(column).toContain(rule));
    expect(html).toContain('flex-direction:row;gap:20px');
    const pill = styleOf('border-radius:24px');
    expect(pill).toContain('justify-content:center');
    expect(pill).toContain('align-items:center');
  });

  it('keeps flow children in the flow instead of at their x/y', () => {
    const gift = styleOf('>Gift cards<');
    expect(gift).toContain('position:relative');
    expect(gift).not.toContain('left:');
    expect(gift).toMatch(/white-space:pre(;|$)/);
  });

  it('stretches a fill_container text across its column', () => {
    const para = styleOf('>Six people');
    expect(para).toContain('align-self:stretch');
    expect(para).toContain('white-space:pre-wrap');
  });

  it('falls back to a font of the same kind', () => {
    expect(styleOf('>Gift cards<')).toContain('font-family:&quot;Inter&quot;, sans-serif');
  });

  it('draws an icon without the gray shape fill', () => {
    expect(html).not.toContain('#3f3f46');
  });

  it('links the Google Fonts the page uses', () => {
    const doc = buildHtmlDocument(page);
    expect(doc).toContain(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap">'
    );
    expect(doc).toContain('family=Fraunces');
  });

  it('also links the regular weight, for families Google rejects in every weight', () => {
    expect(buildHtmlDocument(page)).toContain(
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces&amp;display=swap">'
    );
  });

  it('keeps a safe text shadow', () => {
    const shadowed = renderNodeHtml(
      { id: 's', type: 'text', content: 'x', effects: [{ type: 'shadow', color: '#00000040', blur: 4 }] },
      true
    );
    expect(shadowed).toContain('filter:drop-shadow(0px 0px 4px #00000040)');
  });

  it('drops unsafe font families and effect colors', () => {
    const evil = renderNodeHtml(
      {
        id: 'e',
        type: 'text',
        content: 'x',
        fontFamily: 'Inter;background:url(https://evil.test)',
        effects: [{ type: 'shadow', color: 'red;background:url(https://evil.test)' }],
      },
      true
    );
    expect(evil).not.toContain('evil.test');
    expect(buildHtmlDocument({ id: 'e', type: 'text', content: 'x', fontFamily: 'A&B' })).not.toContain(
      'fonts.googleapis'
    );
  });
});
