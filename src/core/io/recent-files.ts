import { FrameNode, PenDocument } from '../../types/pen-ast';
import { ActivityTimes } from '../../lib/relative-time';

export const MAX_RECENTS = 30;
/** Frames kept per entry for its Home thumbnail; never used to restore the document */
export const MAX_PREVIEW_FRAMES = 6;

export interface RecentEntry extends ActivityTimes {
  id: string;
  name: string;
  handle: FileSystemFileHandle;
  preview: FrameNode[];
}

export interface RecentVisit {
  handle: FileSystemFileHandle;
  document: PenDocument;
  kind: 'opened' | 'edited';
}

export function previewFrames(document: PenDocument): FrameNode[] {
  return document.children.filter((node): node is FrameNode => node.type === 'frame').slice(0, MAX_PREVIEW_FRAMES);
}

const lastActivity = (entry: ActivityTimes) => Math.max(entry.lastOpenedAt, entry.lastEditedAt ?? 0);

async function indexOfHandle(list: RecentEntry[], handle: FileSystemFileHandle): Promise<number> {
  for (let i = 0; i < list.length; i++) {
    if (await list[i].handle.isSameEntry(handle)) return i;
  }
  return -1;
}

const newId = () => `recent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * `list` with `visit` recorded: the file's entry updated (matched by handle, not
 * name) or a new one added, newest activity first, capped at MAX_RECENTS
 */
export async function recordRecent(list: RecentEntry[], visit: RecentVisit, now: number): Promise<RecentEntry[]> {
  const index = await indexOfHandle(list, visit.handle);
  const existing = index === -1 ? undefined : list[index];
  const entry: RecentEntry = {
    id: existing?.id ?? newId(),
    name: visit.handle.name,
    handle: visit.handle,
    preview: previewFrames(visit.document),
    lastOpenedAt: visit.kind === 'opened' ? now : (existing?.lastOpenedAt ?? now),
    lastEditedAt: visit.kind === 'edited' ? now : existing?.lastEditedAt,
  };
  const others = list.filter((_, i) => i !== index);
  return [entry, ...others].sort((a, b) => lastActivity(b) - lastActivity(a)).slice(0, MAX_RECENTS);
}
