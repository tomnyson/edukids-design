import { describe, it, expect, vi, afterEach } from 'vitest';
import { savePenFile, openPenFile, isAbortError, reopenPenFile } from '../../src/core/io/file-system';
import { serializePenDocument } from '../../src/core/io/pen-file-handler';
import { PenDocument } from '../../src/types/pen-ast';

const doc: PenDocument = { version: '2.13', children: [{ id: 'r1', type: 'rect', name: 'Box' }] };

function fakeHandle(name: string) {
  const writable = { write: vi.fn(async () => {}), close: vi.fn(async () => {}) };
  const handle = {
    name,
    kind: 'file',
    createWritable: vi.fn(async () => writable),
    getFile: vi.fn(async () => ({ text: async () => serializePenDocument(doc) })),
  };
  return { handle: handle as unknown as FileSystemFileHandle, writable };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('savePenFile', () => {
  it('writes serialized JSON straight to an existing handle', async () => {
    const { handle, writable } = fakeHandle('landing.pen');

    const result = await savePenFile(doc, 'landing.pen', handle);

    expect(writable.write).toHaveBeenCalledWith(serializePenDocument(doc));
    expect(writable.close).toHaveBeenCalled();
    expect(result).toEqual({ name: 'landing.pen', handle });
  });

  it('asks for a location via the save picker when there is no handle', async () => {
    const { handle, writable } = fakeHandle('picked.pen');
    const showSaveFilePicker = vi.fn(async () => handle);
    vi.stubGlobal('window', { showSaveFilePicker });

    const result = await savePenFile(doc, 'untitled.pen', null);

    expect(showSaveFilePicker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'untitled.pen' })
    );
    expect(writable.write).toHaveBeenCalled();
    expect(result?.name).toBe('picked.pen');
  });

  it('returns null when the user cancels the save picker', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    vi.stubGlobal('window', { showSaveFilePicker: vi.fn(async () => Promise.reject(abort)) });

    await expect(savePenFile(doc, 'untitled.pen', null)).resolves.toBeNull();
  });
});

describe('openPenFile', () => {
  it('reads and validates the picked file', async () => {
    const { handle } = fakeHandle('landing.pen');
    vi.stubGlobal('window', { showOpenFilePicker: vi.fn(async () => [handle]) });

    const result = await openPenFile();

    expect(result?.name).toBe('landing.pen');
    expect(result?.handle).toBe(handle);
    expect(result?.document.children[0].name).toBe('Box');
  });
});

describe('reopenPenFile', () => {
  it('reads a remembered handle once access is granted', async () => {
    const { handle } = fakeHandle('landing.pen');
    const requestPermission = vi.fn(async () => 'granted');
    Object.assign(handle, { queryPermission: vi.fn(async () => 'prompt'), requestPermission });

    const result = await reopenPenFile(handle);

    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(result).toMatchObject({ name: 'landing.pen', handle });
    expect(result.document.children[0].name).toBe('Box');
  });

  it('throws a readable message when access is denied', async () => {
    const { handle } = fakeHandle('landing.pen');
    Object.assign(handle, { queryPermission: vi.fn(async () => 'prompt'), requestPermission: vi.fn(async () => 'denied') });

    await expect(reopenPenFile(handle)).rejects.toThrow('landing.pen');
    expect(handle.getFile).not.toHaveBeenCalled();
  });
});

describe('isAbortError', () => {
  it('recognises picker cancellation only', () => {
    expect(isAbortError(Object.assign(new Error('x'), { name: 'AbortError' }))).toBe(true);
    expect(isAbortError(new Error('boom'))).toBe(false);
  });
});
