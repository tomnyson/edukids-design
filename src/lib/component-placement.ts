import { FrameNode, PenNode } from '../types/pen-ast';
import type { InstancePlacement } from '../store/useDesignStore';
import type { Viewport } from '../store/document-tabs';
import { placeImage, targetFrame } from './image-insert';
import { Size } from './image-source';
import { wouldNest } from './components';

/**
 * Where a new instance of `master` goes: centred in the frame the user is
 * working on, unless that would put the master inside itself; otherwise
 * centred in the visible part of the canvas.
 */
export function instancePlacement(
  children: PenNode[],
  selectedNodeIds: string[],
  viewport: Viewport,
  canvasSize: Size,
  master: FrameNode
): InstancePlacement {
  const size = { width: master.width ?? 0, height: master.height ?? 0 };
  const frame = targetFrame(children, selectedNodeIds);
  if (frame && !wouldNest(children, master.id, frame.id)) {
    return {
      parentId: frame.id,
      x: Math.round(((frame.width ?? 0) - size.width) / 2),
      y: Math.round(((frame.height ?? 0) - size.height) / 2),
    };
  }
  const { x, y } = placeImage([], [], viewport, canvasSize, size);
  return { x, y };
}
