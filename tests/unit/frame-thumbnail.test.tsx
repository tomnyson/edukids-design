import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FrameThumbnail, thumbnailScale } from '../../src/components/sidebar/FrameThumbnail';
import { FrameNode } from '../../src/types/pen-ast';

const page: FrameNode = {
  id: 'F1',
  type: 'frame',
  name: 'Home',
  x: 0,
  y: 0,
  width: 1440,
  height: 900,
  fill: '#060a16',
  children: [{ id: 'T1', type: 'text', x: 10, y: 10, width: 200, height: 40, content: 'Sản phẩm nổi bật' }],
};

describe('thumbnailScale', () => {
  it('fits the frame inside the box keeping its aspect ratio', () => {
    expect(thumbnailScale({ width: 1440, height: 900 }, { width: 240, height: 160 })).toBeCloseTo(240 / 1440);
    expect(thumbnailScale({ width: 1440, height: 9000 }, { width: 240, height: 160 })).toBeCloseTo(160 / 9000);
  });

  it('returns 0 for empty frames instead of dividing by zero', () => {
    expect(thumbnailScale({ width: 0, height: 0 }, { width: 240, height: 160 })).toBe(0);
  });
});

describe('FrameThumbnail', () => {
  const html = renderToStaticMarkup(<FrameThumbnail frame={page} width={240} height={160} />);

  it('renders the frame content', () => {
    expect(html).toContain('Sản phẩm nổi bật');
    expect(html).toContain(`scale(${240 / 1440})`);
  });

  it('never emits canvas node ids, so canvas lookups stay unique', () => {
    expect(html).not.toContain('id="node-');
  });

  it('is not interactive and has no selection outline or frame label', () => {
    expect(html).toContain('pointer-events:none');
    expect(html).not.toContain('outline:2px');
    expect(html).not.toContain('>Home<');
  });
});
