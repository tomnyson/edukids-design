import type { ContextAttachment } from '../store/useDesignStore';

export type TextBlock = { type: 'text'; text: string };
export type ImageMediaType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
export type ImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: ImageMediaType; data: string };
};
export type UserContent = Array<TextBlock | ImageBlock>;

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/;

function imageBlock(attachment: ContextAttachment): ImageBlock | null {
  const match = attachment.previewUrl?.match(DATA_URL_PATTERN);
  if (!match) return null;
  return { type: 'image', source: { type: 'base64', media_type: match[1] as ImageMediaType, data: match[2] } };
}

function attachmentNote(attachment: ContextAttachment): string {
  return attachment.content
    ? `Attached file "${attachment.name}":\n${attachment.content}`
    : `Attached context: ${attachment.name}`;
}

/**
 * User message content shared by the planner and the design agents: image
 * attachments as image blocks, then the text parts and the other attachments.
 */
export function buildUserContent(attachments: ContextAttachment[], parts: string[]): UserContent {
  const images = attachments.map(imageBlock).filter((block): block is ImageBlock => block !== null);
  const notes = attachments.filter((attachment) => !imageBlock(attachment)).map(attachmentNote);
  const text = [...parts, images.length > 0 ? 'Use the attached image(s) as visual reference.' : '', ...notes]
    .filter(Boolean)
    .join('\n\n');
  return [...images, { type: 'text', text }];
}
