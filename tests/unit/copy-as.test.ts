import { describe, it, expect, vi } from 'vitest';
import { copyAsText, copyNodesAs } from '../../src/lib/copy-as';
import { toComponentName } from '../../src/compiler/jsx-export';
import { PenNode } from '../../src/types/pen-ast';

const rect: PenNode = { id: 'card', type: 'rect', name: 'Price card', x: 0, y: 0, width: 120, height: 80, fill: '#f97316' };

const other: PenNode = { id: 'badge', type: 'rect', name: 'Badge', x: 200, y: 40, width: 40, height: 40, fill: '#22c55e' };

const stubClipboard = () => ({ writeText: vi.fn().mockResolvedValue(undefined), write: vi.fn().mockResolvedValue(undefined) });

describe('copyAsText', () => {
  it('json of one node is the node itself', () => {
    expect(JSON.parse(copyAsText('json', [rect])).id).toBe(rect.id);
  });

  it('jsx contains an exported component named after the node', () => {
    const jsx = copyAsText('jsx', [rect]);
    expect(jsx).toContain('export');
    expect(jsx).toContain(toComponentName(rect.name!));
  });

  it('html is a full document', () => {
    expect(copyAsText('html', [rect])).toMatch(/^<!doctype html>/i);
  });

  it('jsx of several nodes is one module with a single import and default export', () => {
    const jsx = copyAsText('jsx', [rect, other]);
    expect(jsx.match(/^import React/gm)).toHaveLength(1);
    expect(jsx.match(/^export default/gm)).toHaveLength(1);
    expect(jsx).toContain('#f97316');
    expect(jsx).toContain('#22c55e');
  });

  it('html of several nodes keeps every node', () => {
    const html = copyAsText('html', [rect, other]);
    expect(html).toContain('#f97316');
    expect(html).toContain('#22c55e');
  });
});

describe('copyNodesAs', () => {
  it('copyNodesAs json writes text', async () => {
    const clipboard = stubClipboard();
    await copyNodesAs('json', [rect], clipboard as unknown as Clipboard);
    expect(clipboard.writeText).toHaveBeenCalledWith(copyAsText('json', [rect]));
  });

  it('copyNodesAs rejects empty nodes', async () => {
    await expect(copyNodesAs('json', [], stubClipboard() as unknown as Clipboard)).rejects.toThrow('Không có layer để copy');
  });

  it('copyNodesAs rejects when clipboard is missing', async () => {
    await expect(copyNodesAs('json', [rect], undefined)).rejects.toThrow('Trình duyệt chặn clipboard');
  });

  it('copyNodesAs reports a rejected permission as blocked', async () => {
    const clipboard = stubClipboard();
    clipboard.writeText.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    await expect(copyNodesAs('json', [rect], clipboard as unknown as Clipboard)).rejects.toThrow('Trình duyệt chặn clipboard');
  });

  it('copyNodesAs png reports why rendering failed instead of blaming the clipboard', async () => {
    vi.stubGlobal('ClipboardItem', class {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    });
    const clipboard = stubClipboard();
    // Like a browser, the write settles with the pending blob
    clipboard.write.mockImplementation(async ([item]: Array<{ items: Record<string, Promise<Blob>> }>) => {
      await item.items['image/png'];
    });
    const empty: PenNode = { ...rect, width: 0 };
    await expect(copyNodesAs('png', [empty], clipboard as unknown as Clipboard)).rejects.toThrow('không có kích thước');
    vi.unstubAllGlobals();
  });

  it('copyNodesAs png reports a render failure that is not an Error as a PNG failure', async () => {
    vi.stubGlobal('ClipboardItem', class {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    });
    const clipboard = stubClipboard();
    clipboard.write.mockImplementation(async ([item]: Array<{ items: Record<string, Promise<Blob>> }>) => {
      await item.items['image/png'];
    });
    // html-to-image rejects with the image's load Event when an <img> fails
    const frameExport = await import('../../src/lib/frame-export');
    const spy = vi.spyOn(frameExport, 'renderPng').mockRejectedValue({ type: 'error' });
    await expect(copyNodesAs('png', [rect], clipboard as unknown as Clipboard)).rejects.toThrow('Không xuất được PNG');
    spy.mockRestore();
    vi.unstubAllGlobals();
  });
});
