import { PenDocument } from '../types/pen-ast';
import { generateNodeId } from '../core/io/pen-file-handler';

export interface HistorySnapshot {
  document: PenDocument;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/**
 * One open document. The active tab is mirrored into the store's top-level
 * fields (document, history, ...) so existing actions keep working; its entry
 * in `tabs` is only refreshed when the user switches away from it.
 */
export interface DocTab {
  id: string;
  name: string;
  document: PenDocument;
  history: HistorySnapshot[];
  historyIndex: number;
  selectedNodeIds: string[];
  viewport: Viewport;
  isDirty: boolean;
  fileHandle: FileSystemFileHandle | null;
}

/** Top-level store fields that mirror the active tab */
export interface ActiveTabFields {
  activeTabId: string;
  documentName: string;
  document: PenDocument;
  history: HistorySnapshot[];
  historyIndex: number;
  selectedNodeIds: string[];
  viewport: Viewport;
  isDirty: boolean;
  fileHandle: FileSystemFileHandle | null;
}

export const DEFAULT_VIEWPORT: Viewport = { x: 40, y: 40, zoom: 1 };

function cloneDocument(doc: PenDocument): PenDocument {
  return JSON.parse(JSON.stringify(doc));
}

export function createTab(
  doc: PenDocument,
  name: string,
  fileHandle: FileSystemFileHandle | null = null
): DocTab {
  const document = cloneDocument(doc);
  return {
    id: `tab-${generateNodeId()}`,
    name,
    document,
    history: [{ document: cloneDocument(document) }],
    historyIndex: 0,
    selectedNodeIds: [],
    viewport: DEFAULT_VIEWPORT,
    isDirty: false,
    fileHandle,
  };
}

/**
 * Picks the first free name in the series untitled.pen, untitled-2.pen, ...
 */
export function uniqueUntitledName(existingNames: string[]): string {
  const taken = new Set(existingNames);
  if (!taken.has('untitled.pen')) return 'untitled.pen';
  let counter = 2;
  while (taken.has(`untitled-${counter}.pen`)) counter++;
  return `untitled-${counter}.pen`;
}

/** Copies the live top-level fields back into the active tab's entry */
export function snapshotActiveTab(tabs: DocTab[], active: ActiveTabFields): DocTab[] {
  return tabs.map((tab) =>
    tab.id === active.activeTabId
      ? {
          ...tab,
          name: active.documentName,
          document: active.document,
          history: active.history,
          historyIndex: active.historyIndex,
          selectedNodeIds: active.selectedNodeIds,
          viewport: active.viewport,
          isDirty: active.isDirty,
          fileHandle: active.fileHandle,
        }
      : tab
  );
}

/** Top-level fields to set when a tab becomes active */
export function activateTab(tab: DocTab): ActiveTabFields & { hoveredNodeId: null } {
  return {
    activeTabId: tab.id,
    documentName: tab.name,
    document: tab.document,
    history: tab.history,
    historyIndex: tab.historyIndex,
    selectedNodeIds: tab.selectedNodeIds,
    viewport: tab.viewport,
    isDirty: tab.isDirty,
    fileHandle: tab.fileHandle,
    hoveredNodeId: null,
  };
}

/** A tab nobody has touched: empty, unsaved and never written to disk */
export function isPristine(active: ActiveTabFields): boolean {
  return !active.isDirty && !active.fileHandle && active.document.children.length === 0;
}

/**
 * Returns the id of the tab already editing `handle`, so opening the same file
 * twice focuses it instead of creating two tabs that overwrite each other.
 */
export async function findTabWithSameFile(
  tabs: Pick<DocTab, 'id' | 'fileHandle'>[],
  handle: FileSystemFileHandle | null
): Promise<string | null> {
  if (!handle) return null;
  for (const tab of tabs) {
    if (tab.fileHandle && (await tab.fileHandle.isSameEntry(handle))) return tab.id;
  }
  return null;
}
