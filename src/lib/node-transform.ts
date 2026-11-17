import { BaseNode } from '../types/pen-ast';

/** CSS transform for a node's rotation and flips, or undefined when it has none */
export function nodeTransform(node: Pick<BaseNode, 'rotation' | 'flipX' | 'flipY'>): string | undefined {
  const parts = [
    node.rotation ? `rotate(${node.rotation}deg)` : undefined,
    node.flipX || node.flipY ? `scale(${node.flipX ? -1 : 1}, ${node.flipY ? -1 : 1})` : undefined,
  ].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(' ') : undefined;
}
