import React from 'react';
import { FrameNode } from '../../types/pen-ast';
import { NodeRenderer } from '../canvas/NodeRenderer';

interface Size {
  width: number;
  height: number;
}

/** Scale that fits `frame` inside `box` keeping its aspect ratio; 0 for an empty frame */
export function thumbnailScale(frame: Size, box: Size): number {
  if (frame.width <= 0 || frame.height <= 0) return 0;
  return Math.min(box.width / frame.width, box.height / frame.height);
}

interface FrameThumbnailProps {
  frame: FrameNode;
  width: number;
  height: number;
}

/** Live, scaled-down and non-interactive copy of a frame, centred in a `width` × `height` box */
export const FrameThumbnail = React.memo(function FrameThumbnail({ frame, width, height }: FrameThumbnailProps) {
  const frameWidth = frame.width ?? 0;
  const frameHeight = frame.height ?? 0;
  const scale = thumbnailScale({ width: frameWidth, height: frameHeight }, { width, height });

  return (
    <div className="relative overflow-hidden" style={{ width, height, pointerEvents: 'none' }} aria-hidden="true">
      <div
        style={{
          position: 'absolute',
          left: (width - frameWidth * scale) / 2,
          top: (height - frameHeight * scale) / 2,
          width: frameWidth,
          height: frameHeight,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        <NodeRenderer node={{ ...frame, x: 0, y: 0 }} isRoot preview />
      </div>
    </div>
  );
});
