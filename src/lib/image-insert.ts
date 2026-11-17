import { FrameNode, ImageNode, PenNode } from '../types/pen-ast';
import { findNodeById } from '../core/io/pen-file-handler';
import { findTopLevelId } from '../compiler/ast-to-html';
import { fitWithin, loadImageSize, safeImageSrc, Size } from './image-source';
import { useDesignStore } from '../store/useDesignStore';
import { Viewport } from '../store/document-tabs';

/** Id of the canvas container, used to find the visible centre when inserting */
export const CANVAS_ELEMENT_ID = 'design-canvas';

export interface ImagePlacement extends Size {
  parentId?: string;
  x: number;
  y: number;
}

/** Frame a new image should go into: the selected frame, else the top-level frame around the selection */
export function targetFrame(children: PenNode[], selectedNodeIds: string[]): FrameNode | null {
  const selectedId = selectedNodeIds[0];
  if (!selectedId) return null;
  const selected = findNodeById(children, selectedId);
  if (selected?.type === 'frame') return selected as FrameNode;
  const topId = findTopLevelId(children, selectedId);
  const top = topId ? children.find((n) => n.id === topId) : undefined;
  return top?.type === 'frame' ? (top as FrameNode) : null;
}

/** Scales `size` down (never up) so it fits inside `box` */
function shrinkToFit(size: Size, box: Size): Size {
  const scale = Math.min(1, box.width / size.width, box.height / size.height);
  return scale > 0 ? { width: Math.round(size.width * scale), height: Math.round(size.height * scale) } : size;
}

/**
 * Where to put an image of `size`: centred in the frame the user is working
 * on (shrunk to fit it), otherwise centred in the visible part of the canvas.
 */
export function placeImage(
  children: PenNode[],
  selectedNodeIds: string[],
  viewport: Viewport,
  canvasSize: Size,
  size: Size
): ImagePlacement {
  const frame = targetFrame(children, selectedNodeIds);
  if (frame) {
    const frameSize = { width: frame.width ?? 0, height: frame.height ?? 0 };
    const fitted = shrinkToFit(size, frameSize);
    return {
      parentId: frame.id,
      ...fitted,
      x: Math.round((frameSize.width - fitted.width) / 2),
      y: Math.round((frameSize.height - fitted.height) / 2),
    };
  }
  const zoom = viewport.zoom || 1;
  return {
    ...size,
    x: Math.round((canvasSize.width / 2 - viewport.x) / zoom - size.width / 2),
    y: Math.round((canvasSize.height / 2 - viewport.y) / zoom - size.height / 2),
  };
}

function visibleCanvasSize(): Size {
  const rect = document.getElementById(CANVAS_ELEMENT_ID)?.getBoundingClientRect();
  return rect ? { width: rect.width, height: rect.height } : { width: window.innerWidth, height: window.innerHeight };
}

export interface InsertImageOptions {
  name?: string;
  /** Canvas coordinates of the image centre; defaults to the frame or viewport centre */
  center?: { x: number; y: number };
}

/** Adds an image node for `src` and selects it; throws a user-facing message when `src` is unusable */
export async function insertImage(src: string, options: InsertImageOptions = {}): Promise<string> {
  const safe = safeImageSrc(src);
  if (!safe) throw new Error('Chỉ hỗ trợ link http(s) hoặc file ảnh.');
  const size = fitWithin(await loadImageSize(safe));

  const { document: doc, selectedNodeIds, viewport, addNode } = useDesignStore.getState();
  const placement: ImagePlacement = options.center
    ? { ...size, x: Math.round(options.center.x - size.width / 2), y: Math.round(options.center.y - size.height / 2) }
    : placeImage(doc.children, selectedNodeIds, viewport, visibleCanvasSize(), size);

  const node: Partial<ImageNode> = {
    type: 'image',
    name: options.name || 'Image',
    src: safe,
    fit: 'cover',
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    fill: undefined,
  };
  return addNode(node, placement.parentId);
}

/** Display name for an uploaded file: its name without the extension */
export function imageNameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || 'Image';
}
