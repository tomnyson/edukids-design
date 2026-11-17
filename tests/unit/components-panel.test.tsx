import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ComponentsList } from '../../src/components/sidebar/ComponentsPanel';
import { instancePlacement } from '../../src/lib/component-placement';
import { FrameNode, PenNode } from '../../src/types/pen-ast';

const frame = (id: string, children: PenNode[], extra: Partial<FrameNode> = {}): FrameNode => ({
  id,
  type: 'frame',
  name: id,
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  children,
  ...extra,
});
const button = frame('btn', [], { reusable: true, name: 'Button', width: 100, height: 40 });
const viewport = { x: 0, y: 0, zoom: 1 };
const canvas = { width: 1000, height: 800 };

describe('instancePlacement', () => {
  it('centres the instance in the selected frame', () => {
    const page = frame('page', [{ id: 'r', type: 'rect', x: 0, y: 0, width: 10, height: 10 }]);
    expect(instancePlacement([button, page], ['r'], viewport, canvas, button)).toEqual({ parentId: 'page', x: 150, y: 130 });
  });

  it('centres it in the visible canvas without a selected frame', () => {
    expect(instancePlacement([button], [], { x: -100, y: 0, zoom: 2 }, canvas, button)).toEqual({ x: 250, y: 180 });
  });

  it('does not drop an instance into its own master', () => {
    expect(instancePlacement([button], ['btn'], viewport, canvas, button)).toEqual({ x: 450, y: 380 });
  });
});

describe('ComponentsList', () => {
  const render = (masters: FrameNode[]) => renderToStaticMarkup(<ComponentsList masters={masters} onInsert={() => {}} />);

  it('lists every master as an insert button', () => {
    const html = render([button, frame('card', [], { reusable: true, name: 'Card' })]);
    const labels = [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]);
    expect(labels).toEqual(['Chèn Button', 'Chèn Card']);
  });

  it('explains how to make one when there are none', () => {
    expect(render([])).toContain('Create Component');
  });
});
