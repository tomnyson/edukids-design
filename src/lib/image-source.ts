import { ImageFit } from '../types/pen-ast';

/**
 * Image sources for `image` nodes: an http(s) URL typed by the user, or an
 * uploaded file stored inline as a data URL so the .pen file stays portable.
 */

/** Uploads are embedded in the .pen file and share links, so keep them small */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Longest side of a freshly inserted image, in canvas px */
export const MAX_INSERT_SIZE = 480;

const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Returns `src` when it is safe to put in an <img>: http(s) URLs and base64
 * image data URLs only. Anything else (javascript:, file:, blob:, ...) is null.
 */
export function safeImageSrc(src: string | undefined): string | null {
  const value = src?.trim();
  if (!value) return null;
  if (value.startsWith('data:')) return DATA_IMAGE.test(value) ? value : null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

const IMAGE_FITS: ReadonlySet<string> = new Set<ImageFit>(['cover', 'contain', 'fill']);

/** `fit` from an untrusted node, defaulting to cover */
export function imageFit(fit: string | undefined): ImageFit {
  return fit && IMAGE_FITS.has(fit) ? (fit as ImageFit) : 'cover';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Reads an uploaded image into a data URL; throws a user-facing message when it is rejected */
export async function readImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`"${file.name}" không phải file ảnh.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Ảnh "${file.name}" lớn hơn ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`);
  }
  const dataUrl = `data:${file.type};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`;
  const safe = safeImageSrc(dataUrl);
  if (!safe) throw new Error(`Định dạng ảnh "${file.type}" chưa được hỗ trợ.`);
  return safe;
}

export interface Size {
  width: number;
  height: number;
}

/** Scales a size down (never up) so its longest side is at most `max` */
export function fitWithin(size: Size, max: number = MAX_INSERT_SIZE): Size {
  const longest = Math.max(size.width, size.height);
  if (longest <= 0) return { width: max, height: max };
  const scale = Math.min(1, max / longest);
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

/** Natural size of an image; rejects when the browser cannot load it */
export function loadImageSize(src: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Không tải được ảnh từ địa chỉ này.'));
    img.src = src;
  });
}
