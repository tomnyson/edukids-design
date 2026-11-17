import { describe, it, expect } from 'vitest';
import {
  boxStyle,
  fontFamiliesIn,
  fontStack,
  googleFontsUrl,
  effectStyle,
  frameLayoutStyle,
  layoutOf,
  paintStyle,
  textStyle,
} from '../../src/components/canvas/node-style';
import { FrameNode, IconNode, PenEffect, PenNode, TextNode } from '../../src/types/pen-ast';

const row = { direction: 'row' as const };
const column = { direction: 'column' as const };

const rect = (extra: Partial<PenNode> = {}): PenNode => ({ id: 'r', type: 'rect', ...extra }) as PenNode;
const text = (extra: Partial<TextNode> = {}): TextNode => ({ id: 't', type: 'text', content: 'Hi', ...extra });

describe('layoutOf', () => {
  it('gives the flow direction of a flex frame', () => {
    expect(layoutOf({ id: 'f', type: 'frame', layout: 'flex', flexDirection: 'column', children: [] })).toEqual(column);
    expect(layoutOf({ id: 'f', type: 'frame', layout: 'flex', children: [] })).toEqual(row);
  });

  it('is undefined for frames that place children freely and for other nodes', () => {
    expect(layoutOf({ id: 'f', type: 'frame', layout: 'none', children: [] })).toBeUndefined();
    expect(layoutOf({ id: 'f', type: 'frame', children: [] })).toBeUndefined();
    expect(layoutOf(rect())).toBeUndefined();
  });
});

describe('boxStyle', () => {
  it('places a node at x/y when its parent has no layout', () => {
    expect(boxStyle(rect({ x: 10, y: 20, width: 30, height: 40 }))).toMatchObject({
      position: 'absolute',
      left: '10px',
      top: '20px',
      width: '30px',
      height: '40px',
    });
  });

  it('lets a flex parent place its children, ignoring x/y', () => {
    const style = boxStyle(rect({ x: 10, y: 20, width: 30, height: 40 }), row);
    expect(style.position).toBe('relative');
    expect(style.left).toBeUndefined();
    expect(style.top).toBeUndefined();
    expect(style.flexShrink).toBe(0);
  });

  it('keeps an absolute child of a flex parent at x/y', () => {
    expect(boxStyle(rect({ x: 5, y: 6, layoutPosition: 'absolute' }), row)).toMatchObject({
      position: 'absolute',
      left: '5px',
      top: '6px',
    });
  });

  it('grows fill_container along the main axis and stretches it across', () => {
    const wide = boxStyle(
      rect({ width: 99, widthSizing: 'fill_container', height: 99, heightSizing: 'fill_container' }),
      row
    );
    expect(wide).toMatchObject({ flex: '1 1 0', minWidth: 0, alignSelf: 'stretch' });
    expect(wide.width).toBeUndefined();
    expect(wide.height).toBeUndefined();

    const tall = boxStyle(rect({ widthSizing: 'fill_container', heightSizing: 'fill_container' }), column);
    expect(tall).toMatchObject({ flex: '1 1 0', minHeight: 0, alignSelf: 'stretch' });
  });

  it('fills the parent box when the parent has no layout', () => {
    expect(boxStyle(rect({ widthSizing: 'fill_container', heightSizing: 'fill_container' }))).toMatchObject({
      width: '100%',
      height: '100%',
    });
  });

  it('sizes fit_content to the content', () => {
    const style = boxStyle(rect({ width: 120, widthSizing: 'fit_content', heightSizing: 'fit_content' }), row);
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
  });

  it('hides a node that is not visible', () => {
    expect(boxStyle(rect({ visible: false })).display).toBe('none');
  });
});

describe('frameLayoutStyle', () => {
  const frame = (extra: Partial<FrameNode>): FrameNode => ({ id: 'f', type: 'frame', children: [], ...extra });

  it('lays out flex frames with gap, padding and alignment', () => {
    expect(
      frameLayoutStyle(
        frame({
          layout: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: [4, 12],
          justifyContent: 'between',
          alignItems: 'center',
          clip: true,
        })
      )
    ).toMatchObject({
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '4px 12px',
      justifyContent: 'space-between',
      alignItems: 'center',
      overflow: 'hidden',
    });
  });

  it('keeps free-form frames as a plain box', () => {
    expect(frameLayoutStyle(frame({ layout: 'none' }))).toMatchObject({ display: 'block', overflow: 'visible' });
  });
});

describe('paintStyle', () => {
  it('uses background-color for a plain colour and background for gradients', () => {
    expect(paintStyle(rect({ fill: '#ff0000' }))).toMatchObject({ backgroundColor: '#ff0000' });
    const gradient = 'linear-gradient(90deg, #000 0%, #fff 100%)';
    const style = paintStyle(rect({ fill: gradient }));
    expect(style.background).toBe(gradient);
    expect(style.backgroundColor).toBeUndefined();
  });

  it('draws a uniform border, or one per side', () => {
    expect(paintStyle(rect({ stroke: '#111111', strokeWidth: 2 }))).toMatchObject({ border: '2px solid #111111' });
    expect(paintStyle(rect({ stroke: '#111111', strokeWidths: { bottom: 1 } }))).toMatchObject({
      borderStyle: 'solid',
      borderColor: '#111111',
      borderWidth: '0px 0px 1px 0px',
    });
  });

  it('rounds corners together or one by one, and ellipses fully', () => {
    expect(paintStyle(rect({ cornerRadius: 6 })).borderRadius).toBe('6px');
    expect(paintStyle(rect({ cornerRadii: [1, 2, 3, 4] })).borderRadius).toBe('1px 2px 3px 4px');
    expect(paintStyle({ id: 'e', type: 'ellipse' }).borderRadius).toBe('50%');
  });
});

describe('effectStyle', () => {
  const shadow: PenEffect = {
    type: 'shadow',
    shadowType: 'outer',
    offset: { x: 0, y: 4 },
    blur: 12,
    spread: 1,
    color: '#00000033',
  };

  it('turns shadows into box-shadow, inner ones inset', () => {
    expect(effectStyle(rect({ effects: [shadow, { ...shadow, shadowType: 'inner' }] })).boxShadow).toBe(
      '0px 4px 12px 1px #00000033, inset 0px 4px 12px 1px #00000033'
    );
  });

  it('uses drop-shadow for text and icons, which have no box', () => {
    const style = effectStyle(text({ effects: [shadow] }));
    expect(style.boxShadow).toBeUndefined();
    expect(style.filter).toBe('drop-shadow(0px 4px 12px #00000033)');
  });

  it('blurs the layer or what is behind it, skipping disabled effects', () => {
    expect(
      effectStyle(
        rect({
          effects: [
            { type: 'blur', radius: 4 },
            { type: 'background_blur', radius: 10 },
            { ...shadow, enabled: false },
          ],
        })
      )
    ).toEqual({ filter: 'blur(4px)', backdropFilter: 'blur(10px)' });
  });
});

describe('textStyle', () => {
  it('keeps text on its lines while the box grows with it', () => {
    expect(textStyle(text({ widthSizing: 'fit_content', heightSizing: 'fit_content' })).whiteSpace).toBe('pre');
    expect(textStyle(text({ width: 100, textGrowth: 'fixed-width', heightSizing: 'fit_content' })).whiteSpace).toBe(
      'pre-wrap'
    );
  });

  it('clips a gradient to the glyphs', () => {
    const style = textStyle(text({ fill: 'linear-gradient(90deg, #000 0%, #fff 100%)' }));
    expect(style).toMatchObject({ backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' });
  });

  it('places text vertically in a fixed box', () => {
    expect(textStyle(text({ textGrowth: 'fixed-width-height', textAlignVertical: 'bottom' })).justifyContent).toBe(
      'flex-end'
    );
    expect(textStyle(text({ textGrowth: 'fixed-width-height' })).justifyContent).toBe('flex-start');
  });

  it('applies the font and decorations', () => {
    expect(
      textStyle(
        text({
          fill: '#222222',
          fontFamily: 'Inter',
          fontSize: 13,
          fontWeight: '600',
          lineHeight: 1.5,
          letterSpacing: 0.2,
          textAlign: 'center',
          fontStyle: 'italic',
          underline: true,
        })
      )
    ).toMatchObject({
      color: '#222222',
      fontFamily: '"Inter", sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      lineHeight: 1.5,
      letterSpacing: '0.2px',
      textAlign: 'center',
      fontStyle: 'italic',
      textDecoration: 'underline',
    });
  });

  it('works on icons too, for their colour', () => {
    const icon: IconNode = { id: 'i', type: 'icon', icon: 'check', fill: '#333333' };
    expect(paintStyle(icon).backgroundColor).toBeUndefined();
  });
});

describe('fontStack', () => {
  it('quotes the family and falls back to a matching generic font', () => {
    expect(fontStack('Be Vietnam Pro')).toBe('"Be Vietnam Pro", sans-serif');
    expect(fontStack('IBM Plex Mono')).toBe('"IBM Plex Mono", monospace');
    expect(fontStack(undefined)).toBe('inherit');
  });

  it('keeps a stack the file already wrote', () => {
    expect(fontStack('Inter, sans-serif')).toBe('Inter, sans-serif');
  });
});

describe('googleFontsUrl', () => {
  it('asks for one family in the weights the app uses, or in its regular weight only', () => {
    expect(googleFontsUrl('Be Vietnam Pro')).toBe(
      'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700&display=swap'
    );
    expect(googleFontsUrl('Be Vietnam Pro', false)).toBe(
      'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro&display=swap'
    );
  });

  it('leaves out names that are stacks, generic or unsafe', () => {
    for (const name of ['Inter, sans-serif', 'sans-serif', 'x"><script>', 'inherit', '']) {
      expect(googleFontsUrl(name)).toBeUndefined();
    }
  });
});

describe('fontFamiliesIn', () => {
  it('lists each text font once, nested ones and instance overrides included', () => {
    const nodes: PenNode[] = [
      {
        id: 'f',
        type: 'frame',
        children: [text({ fontFamily: 'Be Vietnam Pro' }), text({ id: 't2', fontFamily: 'IBM Plex Mono' })],
      },
      text({ id: 't3', fontFamily: 'Be Vietnam Pro' }),
      { id: 'i', type: 'component', componentId: 'f', descendants: { t: { fontFamily: 'Lora' } } },
    ];
    expect(fontFamiliesIn(nodes)).toEqual(['Be Vietnam Pro', 'IBM Plex Mono', 'Lora']);
  });
});
