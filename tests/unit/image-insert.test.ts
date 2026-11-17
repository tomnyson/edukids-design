import { describe, it, expect } from 'vitest';
import { placeImage } from '../../src/lib/image-insert';
import { PenNode } from '../../src/types/pen-ast';

const children: PenNode[] = [
  {
    id: 'page',
    type: 'frame',
    x: 500,
    y: 500,
    width: 1000,
    height: 600,
    children: [{ id: 'title', type: 'text', x: 10, y: 10, width: 100, height: 20, content: 'Hi' }],
  },
  { id: 'loose', type: 'rect', x: 0, y: 0, width: 10, height: 10 },
];
const viewport = { x: 100, y: 50, zoom: 2 };
const canvas = { width: 800, height: 600 };
const size = { width: 200, height: 100 };

describe('placeImage', () => {
  it('centres the image inside the selected frame', () => {
    expect(placeImage(children, ['page'], viewport, canvas, size)).toEqual({ parentId: 'page', width: 200, height: 100, x: 400, y: 250 });
  });

  it('uses the top-level frame around a selected child', () => {
    expect(placeImage(children, ['title'], viewport, canvas, size).parentId).toBe('page');
  });

  it('centres the image in the visible canvas when no frame is selected', () => {
    // centre of the screen (400, 300) maps to canvas ((400-100)/2, (300-50)/2) = (150, 125)
    expect(placeImage(children, ['loose'], viewport, canvas, size)).toEqual({ width: 200, height: 100, x: 50, y: 75 });
    expect(placeImage(children, [], viewport, canvas, size)).toEqual({ width: 200, height: 100, x: 50, y: 75 });
  });

  it('shrinks images that are larger than the target frame', () => {
    const big = { width: 2000, height: 600 };
    expect(placeImage(children, ['page'], viewport, canvas, big)).toEqual({ parentId: 'page', width: 1000, height: 300, x: 0, y: 150 });
  });
});
