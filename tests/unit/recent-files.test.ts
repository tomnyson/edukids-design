import { describe, it, expect } from 'vitest';
import { MAX_RECENTS, MAX_PREVIEW_FRAMES, previewFrames, recordRecent, RecentEntry } from '../../src/core/io/recent-files';
import { FrameNode, PenDocument } from '../../src/types/pen-ast';

/** Handles compare equal when they share a path, like FileSystemHandle.isSameEntry */
function fakeHandle(path: string, name = path.split('/').pop()!): FileSystemFileHandle {
  const handle = {
    name,
    path,
    isSameEntry: async (other: { path?: string }) => other.path === path,
  };
  return handle as unknown as FileSystemFileHandle;
}

const frame = (id: string): FrameNode => ({ id, type: 'frame', name: id, x: 0, y: 0, width: 100, height: 80, children: [] });
const doc = (children: PenDocument['children']): PenDocument => ({ version: '2.13', children });

describe('previewFrames', () => {
  it('keeps only top-level frames, at most MAX_PREVIEW_FRAMES', () => {
    const many = Array.from({ length: MAX_PREVIEW_FRAMES + 3 }, (_, i) => frame(`F${i}`));
    const children = [{ id: 'r', type: 'rect' as const, x: 0, y: 0, width: 1, height: 1 }, ...many];
    const result = previewFrames(doc(children));
    expect(result.map((f) => f.id)).toEqual(many.slice(0, MAX_PREVIEW_FRAMES).map((f) => f.id));
  });
});

describe('recordRecent', () => {
  it('adds a new file at the top with its preview', async () => {
    const handle = fakeHandle('/a/landing.pen');
    const list = await recordRecent([], { handle, document: doc([frame('F1')]), kind: 'opened' }, 1000);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: 'landing.pen', lastOpenedAt: 1000, handle });
    expect(list[0].preview.map((f) => f.id)).toEqual(['F1']);
    expect(list[0].lastEditedAt).toBeUndefined();
  });

  it('updates the same file in place instead of duplicating it, keeping its id', async () => {
    const first = await recordRecent([], { handle: fakeHandle('/a/x.pen'), document: doc([]), kind: 'opened' }, 1000);
    const second = await recordRecent(first, { handle: fakeHandle('/a/x.pen'), document: doc([frame('F2')]), kind: 'edited' }, 2000);
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe(first[0].id);
    expect(second[0]).toMatchObject({ lastOpenedAt: 1000, lastEditedAt: 2000 });
    expect(second[0].preview.map((f) => f.id)).toEqual(['F2']);
  });

  it('keeps two files with the same name in different folders apart', async () => {
    const one = await recordRecent([], { handle: fakeHandle('/a/untitled.pen'), document: doc([]), kind: 'opened' }, 1000);
    const two = await recordRecent(one, { handle: fakeHandle('/b/untitled.pen'), document: doc([]), kind: 'opened' }, 2000);
    expect(two).toHaveLength(2);
  });

  it('sorts by latest activity, opened or edited', async () => {
    let list: RecentEntry[] = [];
    list = await recordRecent(list, { handle: fakeHandle('/a.pen'), document: doc([]), kind: 'opened' }, 1000);
    list = await recordRecent(list, { handle: fakeHandle('/b.pen'), document: doc([]), kind: 'opened' }, 2000);
    list = await recordRecent(list, { handle: fakeHandle('/a.pen'), document: doc([]), kind: 'edited' }, 3000);
    expect(list.map((e) => e.name)).toEqual(['a.pen', 'b.pen']);
  });

  it('drops the oldest entries past MAX_RECENTS', async () => {
    let list: RecentEntry[] = [];
    for (let i = 0; i < MAX_RECENTS + 2; i++) {
      list = await recordRecent(list, { handle: fakeHandle(`/f${i}.pen`), document: doc([]), kind: 'opened' }, i);
    }
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0].name).toBe(`f${MAX_RECENTS + 1}.pen`);
    expect(list.some((e) => e.name === 'f0.pen')).toBe(false);
  });

  it('does not mutate the list it was given', async () => {
    const list = await recordRecent([], { handle: fakeHandle('/a.pen'), document: doc([]), kind: 'opened' }, 1000);
    const snapshot = [...list];
    await recordRecent(list, { handle: fakeHandle('/a.pen'), document: doc([]), kind: 'edited' }, 2000);
    expect(list).toEqual(snapshot);
    expect(list[0].lastEditedAt).toBeUndefined();
  });
});
