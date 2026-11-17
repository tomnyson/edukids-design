import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { activeSlideId, SlidesList, slidesOf } from '../../src/components/sidebar/SlidesPanel';
import { FrameNode, PenNode } from '../../src/types/pen-ast';

const frame = (id: string, name: string, x: number): FrameNode => ({
  id,
  type: 'frame',
  name,
  x,
  y: 0,
  width: 1440,
  height: 900,
  children: [{ id: `${id}-t`, type: 'text', x: 10, y: 10, content: `${name} content` }],
});
const rect: PenNode = { id: 'R', type: 'rect', x: 0, y: 0, width: 10, height: 10 };
const nodes = [frame('F1', 'Home', 0), rect, frame('F2', 'Pricing', 2000)];

const render = (frames: FrameNode[], activeId: string | null = null) =>
  renderToStaticMarkup(<SlidesList frames={frames} activeId={activeId} onSelect={() => {}} />);
const cards = (html: string) => [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);

describe('slidesOf', () => {
  it('keeps only the top-level frames, in order', () => {
    expect(slidesOf(nodes).map((node) => node.id)).toEqual(['F1', 'F2']);
  });
});

describe('activeSlideId', () => {
  it('resolves a selected child to the slide that holds it', () => {
    expect(activeSlideId(nodes, ['F2-t'])).toBe('F2');
  });

  it('is null with nothing selected', () => {
    expect(activeSlideId(nodes, [])).toBeNull();
  });
});

describe('SlidesList', () => {
  it('numbers the slides by name', () => {
    const labels = cards(render(slidesOf(nodes))).map((tag) => tag.match(/aria-label="([^"]+)"/)?.[1]);
    expect(labels).toEqual(['Slide 1: Home', 'Slide 2: Pricing']);
  });

  it('marks only the active slide as current', () => {
    const html = render(slidesOf(nodes), 'F2');
    expect(cards(html).map((tag) => tag.includes('aria-current="true"'))).toEqual([false, true]);
  });

  it('shows the empty state without slides', () => {
    const html = render([]);
    expect(html).toContain('Tài liệu trống');
    expect(cards(html)).toHaveLength(0);
  });
});
