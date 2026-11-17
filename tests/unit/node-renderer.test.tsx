import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NodeRenderer } from '../../src/components/canvas/NodeRenderer';
import { FrameNode } from '../../src/types/pen-ast';

const screen: FrameNode = {
  id: 'F1',
  type: 'frame',
  name: 'Home',
  x: 100,
  y: 50,
  width: 400,
  height: 300,
  clip: true,
  layout: 'flex',
  flexDirection: 'column',
  padding: 16,
  children: [{ id: 'T1', type: 'text', content: 'Inside' }],
};

/** The markup of the element whose opening tag contains `marker`, to its closing tag */
function elementAround(html: string, marker: string): string {
  const open = html.lastIndexOf('<div', html.indexOf(marker));
  let depth = 0;
  for (let at = open; at < html.length; at++) {
    if (html.startsWith('<div', at)) depth++;
    if (html.startsWith('</div>', at) && --depth === 0) return html.slice(open, at + '</div>'.length);
  }
  return html.slice(open);
}

describe('NodeRenderer frame', () => {
  const html = renderToStaticMarkup(<NodeRenderer node={screen} isRoot />);

  it('keeps the name of a clipping root frame outside the clipped area', () => {
    expect(elementAround(html, 'id="node-F1"')).toContain('Home');
    expect(elementAround(html, 'overflow:hidden')).not.toContain('Home');
  });

  it('clips and lays out the children inside the frame box', () => {
    const content = elementAround(html, 'overflow:hidden');
    expect(content).toContain('Inside');
    expect(content).toContain('flex-direction:column');
    expect(content).toContain('padding:16px');
  });
});
