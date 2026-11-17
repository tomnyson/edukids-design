import { useCallback, useMemo } from 'react';
import { useDesignStore } from '../store/useDesignStore';
import {
  openPenFile,
  savePenFile,
  downloadTextFile,
  downloadBlob,
  reopenPenFile,
  OpenedPenFile,
} from '../core/io/file-system';
import { addRecent } from '../core/io/recent-store';
import { RecentEntry, RecentVisit } from '../core/io/recent-files';
import { PenDocument } from '../types/pen-ast';
import { serializePenDocument } from '../core/io/pen-file-handler';
import { buildJsxExport } from '../compiler/jsx-export';
import { buildHtmlExport, resolveExportTarget } from '../compiler/ast-to-html';
import { dataUrlToBlob, renderPdf, renderPng } from '../lib/frame-export';
import { buildShareUrl } from '../lib/share-link';
import { findTabWithSameFile } from '../store/document-tabs';
import { notify } from '../lib/toast';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Lỗi không xác định';
}

/** Browsers and chat apps start truncating URLs well before 2 MB */
const MAX_SHARE_URL_LENGTH = 1_500_000;
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** The async clipboard API needs a secure context; plain-http LAN hosts fall back to a prompt */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  window.prompt('Copy link chia sẻ:', text);
}

/** Adds the file to Home's Recents; a failure there must not break opening or saving */
function remember(handle: FileSystemFileHandle | null, document: PenDocument, kind: RecentVisit['kind']): void {
  if (!handle) return;
  addRecent({ handle, document, kind }).catch((err) =>
    notify(`⚠️ Không cập nhật được danh sách gần đây: ${errorMessage(err)}`)
  );
}

/** Shows `opened` in its tab: the one already editing that file, or a new one */
async function showOpenedFile(opened: OpenedPenFile): Promise<void> {
  const state = useDesignStore.getState();
  // The active tab's handle lives at the top level; its `tabs` entry may be stale
  const candidates = state.tabs.map((t) =>
    t.id === state.activeTabId ? { id: t.id, fileHandle: state.fileHandle } : t
  );
  const existingId = await findTabWithSameFile(candidates, opened.handle);
  if (existingId) {
    useDesignStore.getState().switchTab(existingId);
    notify(`📂 ${opened.name} đã được mở sẵn trong tab khác.`);
  } else {
    useDesignStore.getState().loadDocument(opened.document, opened.name, opened.handle);
  }
  remember(opened.handle, opened.document, 'opened');
}

export interface FileActions {
  newDocument: () => void;
  openFile: () => Promise<void>;
  /** Opens a Recents entry; call from a click, since the browser asks for file access again */
  openRecent: (entry: RecentEntry) => Promise<boolean>;
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  exportPen: () => void;
  exportJsx: () => void;
  exportHtml: () => void;
  exportPng: () => Promise<void>;
  exportPdf: () => Promise<void>;
  copyShareLink: () => Promise<void>;
  closeTab: (id: string) => void;
}

/**
 * File menu commands shared by the window chrome and keyboard shortcuts.
 * Reads the store lazily so callbacks stay stable across renders.
 */
export function useFileActions(): FileActions {
  const newDocument = useCallback(() => useDesignStore.getState().createNewDocument(), []);

  const openFile = useCallback(async () => {
    try {
      const opened = await openPenFile();
      if (opened) await showOpenedFile(opened);
    } catch (err) {
      notify(`⚠️ Không mở được file: ${errorMessage(err)}`);
    }
  }, []);

  const openRecent = useCallback(async (entry: RecentEntry) => {
    try {
      await showOpenedFile(await reopenPenFile(entry.handle));
      return true;
    } catch (err) {
      notify(`⚠️ Không mở lại được ${entry.name}: ${errorMessage(err)}`, 5000);
      return false;
    }
  }, []);

  const save = useCallback(async (saveAs: boolean) => {
    const { activeTabId, document, documentName, fileHandle } = useDesignStore.getState();
    try {
      const saved = await savePenFile(document, documentName, saveAs ? null : fileHandle);
      if (!saved) return;
      useDesignStore.getState().markSaved(activeTabId, saved.name, saved.handle, document);
      remember(saved.handle, document, 'edited');
      notify(`💾 Đã lưu ${saved.name}`);
    } catch (err) {
      notify(`⚠️ Không lưu được file: ${errorMessage(err)}`);
    }
  }, []);

  const saveFile = useCallback(() => save(false), [save]);
  const saveFileAs = useCallback(() => save(true), [save]);

  const exportPen = useCallback(() => {
    const { document, documentName } = useDesignStore.getState();
    downloadTextFile(documentName, serializePenDocument(document), 'application/json');
  }, []);

  const exportJsx = useCallback(() => {
    const { document, selectedNodeIds, documentName } = useDesignStore.getState();
    const result = buildJsxExport(document, selectedNodeIds, documentName);
    if (!result) {
      notify('⚠️ Canvas trống, không có gì để xuất.');
      return;
    }
    downloadTextFile(result.filename, result.content, 'text/plain');
    notify(`📦 Đã xuất ${result.filename}`);
  }, []);

  const exportHtml = useCallback(() => {
    const { document, selectedNodeIds, documentName } = useDesignStore.getState();
    const result = buildHtmlExport(document, selectedNodeIds, documentName);
    if (!result) {
      notify('⚠️ Canvas trống, không có gì để xuất.');
      return;
    }
    downloadTextFile(result.filename, result.content, 'text/html');
    notify(`📦 Đã xuất ${result.filename}`);
  }, []);

  const exportRaster = useCallback(async (format: 'png' | 'pdf') => {
    const { document, selectedNodeIds, documentName } = useDesignStore.getState();
    const target = resolveExportTarget(document, selectedNodeIds, documentName);
    if (!target) {
      notify('⚠️ Canvas trống, không có gì để xuất.');
      return;
    }
    const filename = `${target.basename}.${format}`;
    notify(`⏳ Đang xuất ${filename}…`, 10_000);
    try {
      const blob =
        format === 'png' ? dataUrlToBlob((await renderPng(target.root)).dataUrl) : await renderPdf(target.root);
      downloadBlob(filename, blob);
      notify(`📦 Đã xuất ${filename}. Ảnh từ link không cho phép CORS sẽ hiện ô tối.`, 4000);
    } catch (err) {
      notify(`⚠️ Không xuất được ${format.toUpperCase()}: ${errorMessage(err)}`, 5000);
    }
  }, []);

  const exportPng = useCallback(() => exportRaster('png'), [exportRaster]);
  const exportPdf = useCallback(() => exportRaster('pdf'), [exportRaster]);

  const copyShareLink = useCallback(async () => {
    const { document } = useDesignStore.getState();
    if (document.children.length === 0) {
      notify('⚠️ Canvas trống, không có gì để chia sẻ.');
      return;
    }
    try {
      const url = await buildShareUrl(document, window.location.href);
      if (url.length > MAX_SHARE_URL_LENGTH) {
        notify('⚠️ Thiết kế quá lớn để gói vào link. Dùng File → Export .pen để gửi file.', 5000);
        return;
      }
      await copyText(url);
      const localOnly = LOCAL_HOSTNAMES.has(window.location.hostname);
      notify(
        localOnly
          ? '🔗 Đã copy link chia sẻ. Link chứa cả thiết kế, nhưng chỉ mở được trên máy đang chạy app (localhost).'
          : '🔗 Đã copy link chia sẻ. Ai mở link sẽ nhận một bản sao thiết kế.',
        5000
      );
    } catch (err) {
      notify(`⚠️ Không tạo được link chia sẻ: ${errorMessage(err)}`);
    }
  }, []);

  const closeTab = useCallback((id: string) => {
    const state = useDesignStore.getState();
    const tab = state.tabs.find((t) => t.id === id);
    const isDirty = id === state.activeTabId ? state.isDirty : tab?.isDirty;
    const name = id === state.activeTabId ? state.documentName : tab?.name;
    if (isDirty && !window.confirm(`"${name}" có thay đổi chưa lưu. Đóng tab và bỏ thay đổi?`)) {
      return;
    }
    state.closeTab(id);
  }, []);

  return useMemo(
    () => ({
      newDocument,
      openFile,
      openRecent,
      saveFile,
      saveFileAs,
      exportPen,
      exportJsx,
      exportHtml,
      exportPng,
      exportPdf,
      copyShareLink,
      closeTab,
    }),
    [
      newDocument,
      openFile,
      openRecent,
      saveFile,
      saveFileAs,
      exportPen,
      exportJsx,
      exportHtml,
      exportPng,
      exportPdf,
      copyShareLink,
      closeTab,
    ]
  );
}
