import { describe, it, expect } from 'vitest';
import { fitWithin, MAX_IMAGE_BYTES, readImageFile, safeImageSrc } from '../../src/lib/image-source';

describe('safeImageSrc', () => {
  it('accepts http(s) URLs and base64 image data URLs', () => {
    expect(safeImageSrc(' https://cdn.test/a.png ')).toBe('https://cdn.test/a.png');
    expect(safeImageSrc('http://localhost:5173/a.jpg')).toBe('http://localhost:5173/a.jpg');
    expect(safeImageSrc('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('rejects scripts, local files and malformed values', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBeNull();
    expect(safeImageSrc('file:///etc/passwd')).toBeNull();
    expect(safeImageSrc('data:text/html;base64,PHNjcmlwdD4=')).toBeNull();
    expect(safeImageSrc('data:image/png;base64,"><script>')).toBeNull();
    expect(safeImageSrc('not a url')).toBeNull();
    expect(safeImageSrc('')).toBeNull();
    expect(safeImageSrc(undefined)).toBeNull();
  });
});

describe('readImageFile', () => {
  it('turns an uploaded image into a data URL', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
    expect(await readImageFile(file)).toBe('data:image/png;base64,iVBORw==');
  });

  it('rejects files that are not images or are too large', async () => {
    await expect(readImageFile(new File(['hi'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('không phải file ảnh');
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.png', { type: 'image/png' });
    await expect(readImageFile(big)).rejects.toThrow('lớn hơn');
  });
});

describe('fitWithin', () => {
  it('scales large images down keeping the aspect ratio', () => {
    expect(fitWithin({ width: 1920, height: 1080 }, 480)).toEqual({ width: 480, height: 270 });
  });

  it('never scales small images up', () => {
    expect(fitWithin({ width: 64, height: 32 }, 480)).toEqual({ width: 64, height: 32 });
  });
});

describe('pen validator', () => {
  it('keeps image nodes and rejects unknown fit values', async () => {
    const { safeParsePenDocument } = await import('../../src/core/schema/pen-validator');
    const image = { id: 'i', type: 'image', src: 'https://cdn.test/a.png', fit: 'contain', alt: 'A' };
    const ok = safeParsePenDocument({ children: [image] });
    expect(ok.success && ok.data.children[0]).toMatchObject(image);
    expect(safeParsePenDocument({ children: [{ ...image, fit: 'tile' }] }).success).toBe(false);
  });
});
