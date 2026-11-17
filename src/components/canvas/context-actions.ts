import { useDesignStore } from '../../store/useDesignStore';
import { ContextAction } from '../../lib/context-menu';
import { CopyFormat, copyNodesAs } from '../../lib/copy-as';
import { Point } from '../../lib/node-ops';
import { topmostSelected } from '../../lib/canvas-editing';
import { findNodeById } from '../../core/io/pen-file-handler';
import { PenNode } from '../../types/pen-ast';
import { notify } from '../../lib/toast';
import { expandInstances } from '../../lib/components';

/** Where "Paste here" drops the clipboard: inside `parentId` (top level for null) at `point` */
export interface PasteTarget {
  parentId: string | null;
  point: Point;
}

const COPY_FORMAT_LABEL: Record<CopyFormat, string> = { json: 'JSON', jsx: 'JSX', html: 'HTML', png: 'PNG' };

/** Runs a context-menu or shortcut action against the current selection */
export function runContextAction(action: ContextAction, paste?: PasteTarget): void {
  const store = useDesignStore.getState();
  switch (action) {
    case 'copy':
      return store.copySelection();
    case 'paste-here':
      return paste ? store.pasteAt(paste.parentId, paste.point) : store.pasteClipboard();
    case 'paste-replace':
      return store.pasteToReplace();
    case 'bring-front':
      return store.reorderSelection('front');
    case 'send-back':
      return store.reorderSelection('back');
    case 'group':
    case 'frame':
      if (store.selectedNodeIds.length > 0 && !store.groupSelection(action)) notify('Chỉ nhóm được các layer cùng cấp');
      return;
    case 'ungroup':
      return store.ungroupSelection();
    case 'add-flex':
      return store.addFlexLayout();
    case 'remove-flex':
      return store.removeFlexLayout();
    case 'flip-h':
      return store.flipSelection('x');
    case 'flip-v':
      return store.flipSelection('y');
    case 'delete':
      return store.deleteSelectedNodes();
    case 'create-component':
      return store.createComponent();
    case 'detach-instance':
      return store.detachSelection();
  }
}

/** Topmost selected nodes, the ones a copy or a menu acts on */
export function selectedTopNodes(): PenNode[] {
  const { document: doc, selectedNodeIds } = useDesignStore.getState();
  return topmostSelected(doc.children, selectedNodeIds)
    .map((id) => findNodeById(doc.children, id))
    .filter((node): node is PenNode => node !== null);
}

/** Copies the selection to the system clipboard and reports the outcome in a toast */
export async function runCopyAs(format: CopyFormat): Promise<void> {
  try {
    // Other apps know nothing of instances, so they get what each instance shows
    const docNodes = useDesignStore.getState().document.children;
    await copyNodesAs(format, expandInstances(selectedTopNodes(), docNodes));
    notify(`📋 Đã copy dạng ${COPY_FORMAT_LABEL[format]}`);
  } catch (error: unknown) {
    notify(`❌ ${error instanceof Error ? error.message : 'Không copy được'}`);
  }
}
