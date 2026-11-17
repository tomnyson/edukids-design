import { PenDocument } from '../../types/pen-ast';
import { serializePenDocument, deserializePenDocument } from './pen-file-handler';

/**
 * File System Access API (Chromium only). Not part of TypeScript's lib.dom yet,
 * so only the members used here are declared.
 */
interface PickerFileType {
  description: string;
  accept: Record<string, string[]>;
}

interface FilePickerWindow {
  showOpenFilePicker?: (options?: {
    types?: PickerFileType[];
    multiple?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: PickerFileType[];
  }) => Promise<FileSystemFileHandle>;
}

interface PermissionAwareHandle {
  queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
}

export interface OpenedPenFile {
  document: PenDocument;
  name: string;
  handle: FileSystemFileHandle | null;
}

export interface SavedPenFile {
  name: string;
  handle: FileSystemFileHandle | null;
}

const PEN_FILE_TYPES: PickerFileType[] = [
  { description: 'Pen design document', accept: { 'application/json': ['.pen'] } },
];

function pickerWindow(): FilePickerWindow | null {
  return typeof window === 'undefined' ? null : (window as unknown as FilePickerWindow);
}

/** The user dismissed a native picker; callers should treat it as a no-op */
export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

async function ensureWritePermission(handle: FileSystemFileHandle): Promise<void> {
  const aware = handle as unknown as PermissionAwareHandle;
  if (!aware.queryPermission || !aware.requestPermission) return;
  if ((await aware.queryPermission({ mode: 'readwrite' })) === 'granted') return;
  if ((await aware.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    throw new Error(`Không có quyền ghi vào ${handle.name}`);
  }
}

async function writeToHandle(handle: FileSystemFileHandle, content: string): Promise<void> {
  await ensureWritePermission(handle);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

/** Triggers a browser download; used for exports and where the picker API is missing */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  downloadBlob(filename, new Blob([content], { type: mimeType }));
}

/** Triggers a browser download of binary content (images, PDFs) */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = filename;
  // Attached anchors + deferred revoke keep the download reliable in Safari/Firefox
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Classic <input type="file"> picker for browsers without showOpenFilePicker */
function pickFileWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = window.document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Reads a file remembered from an earlier session (Recents). Asks for access
 * again, so call it from a click handler; throws when access is refused.
 */
export async function reopenPenFile(handle: FileSystemFileHandle): Promise<OpenedPenFile> {
  await ensureWritePermission(handle);
  const file = await handle.getFile();
  return { document: deserializePenDocument(await file.text()), name: handle.name, handle };
}

/**
 * Lets the user pick a .pen file and returns it parsed and validated.
 * Resolves null when the picker is cancelled; throws on unreadable/invalid files.
 */
export async function openPenFile(): Promise<OpenedPenFile | null> {
  const win = pickerWindow();
  if (win?.showOpenFilePicker) {
    try {
      const [handle] = await win.showOpenFilePicker({ types: PEN_FILE_TYPES, multiple: false });
      const file = await handle.getFile();
      return { document: deserializePenDocument(await file.text()), name: handle.name, handle };
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }

  const file = await pickFileWithInput('.pen,.json');
  if (!file) return null;
  return { document: deserializePenDocument(await file.text()), name: file.name, handle: null };
}

/**
 * Saves the document. Writes in place when a handle exists, otherwise asks for
 * a location (or downloads the file when the picker API is unavailable).
 * Resolves null when the user cancels the save dialog.
 */
export async function savePenFile(
  doc: PenDocument,
  name: string,
  handle: FileSystemFileHandle | null
): Promise<SavedPenFile | null> {
  const content = serializePenDocument(doc);
  if (handle) {
    await writeToHandle(handle, content);
    return { name: handle.name, handle };
  }

  const win = pickerWindow();
  if (win?.showSaveFilePicker) {
    try {
      const picked = await win.showSaveFilePicker({ suggestedName: name, types: PEN_FILE_TYPES });
      await writeToHandle(picked, content);
      return { name: picked.name, handle: picked };
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }

  downloadTextFile(name, content, 'application/json');
  return { name, handle: null };
}
