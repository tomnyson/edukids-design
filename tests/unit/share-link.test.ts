import { describe, it, expect } from 'vitest';
import { buildShareUrl, readSharedDocument, SHARE_HASH_PREFIX } from '../../src/lib/share-link';
import { PenDocument } from '../../src/types/pen-ast';
import { deserializePenDocument, serializePenDocument } from '../../src/core/io/pen-file-handler';

const doc: PenDocument = {
  version: '2.13',
  children: [
    {
      id: 'f1',
      type: 'frame',
      name: 'Tiệm bánh',
      x: 0,
      y: 0,
      width: 1280,
      height: 800,
      children: [{ id: 't1', type: 'text', content: 'Xin chào 🍞', x: 10, y: 10 }],
    },
  ],
};

describe('share links', () => {
  it('round-trips a document through the URL hash', async () => {
    const url = await buildShareUrl(doc, 'http://localhost:5173/');
    expect(url.startsWith(`http://localhost:5173/#${SHARE_HASH_PREFIX}`)).toBe(true);
    // base64url: survives copy/paste and chat apps without percent-encoding
    expect(new URL(url).hash.slice(1 + SHARE_HASH_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]+$/);
    const shared = await readSharedDocument(new URL(url).hash);
    // Shared documents go through the same validation (and defaults) as opened files
    expect(shared).toEqual(deserializePenDocument(serializePenDocument(doc)));
  });

  it('drops any existing hash or query from the base URL', async () => {
    const url = await buildShareUrl(doc, 'http://localhost:5173/?x=1#old');
    expect(url.startsWith(`http://localhost:5173/#${SHARE_HASH_PREFIX}`)).toBe(true);
  });

  it('ignores hashes that are not share links', async () => {
    expect(await readSharedDocument('')).toBeNull();
    expect(await readSharedDocument('#section')).toBeNull();
  });

  it('rejects corrupted or invalid payloads', async () => {
    await expect(readSharedDocument(`#${SHARE_HASH_PREFIX}not-gzip`)).rejects.toThrow();
  });
});

describe('component round trip', () => {
  const withComponents: PenDocument = {
    version: '2.13',
    children: [
      { id: 'btn', type: 'frame', name: 'Button', reusable: true, x: 0, y: 0, width: 120, height: 40, children: [] },
      { id: 'inst', type: 'component', name: 'Button', componentId: 'btn', x: 20, y: 30, width: 120, height: 40 },
    ],
  };

  it('keeps masters and instances through save and open', () => {
    expect(deserializePenDocument(serializePenDocument(withComponents))).toEqual(withComponents);
  });

  it('keeps masters and instances through a share link', async () => {
    const url = await buildShareUrl(withComponents, 'http://localhost/');
    expect(await readSharedDocument(new URL(url).hash)).toEqual(withComponents);
  });
});
