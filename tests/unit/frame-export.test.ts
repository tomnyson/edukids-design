import { describe, it, expect } from 'vitest';
import { dataUrlToBlob, exportPixelRatio, exportSize } from '../../src/lib/frame-export';

describe('exportSize', () => {
  it('rounds the root size', () => {
    expect(exportSize({ id: 'r', type: 'rect', width: 1280.4, height: 720.6 })).toEqual({ width: 1280, height: 721 });
  });

  it('rejects empty roots', () => {
    expect(() => exportSize({ id: 'r', type: 'rect', width: 0, height: 100 })).toThrow('không có kích thước');
  });
});

describe('exportPixelRatio', () => {
  it('uses 2x for normal frames', () => {
    expect(exportPixelRatio({ width: 1280, height: 720 })).toBe(2);
  });

  it('stays inside browser canvas limits for huge canvases', () => {
    const size = { width: 6000, height: 5000 };
    const ratio = exportPixelRatio(size);
    expect(ratio).toBeLessThan(2);
    expect(size.width * ratio * size.height * ratio).toBeLessThanOrEqual(16_777_216 + 1);
    expect(exportPixelRatio({ width: 20_000, height: 100 }) * 20_000).toBeLessThanOrEqual(16_384);
  });
});

describe('dataUrlToBlob', () => {
  it('decodes base64 data URLs with their mime type', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,iVBORw==');
    expect(blob.type).toBe('image/png');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([137, 80, 78, 71]);
  });
});
