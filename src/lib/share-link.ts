import { PenDocument } from '../types/pen-ast';
import { deserializePenDocument, serializePenDocument } from '../core/io/pen-file-handler';

/**
 * Share links carry the whole document, gzipped and base64url-encoded, in the
 * URL hash. There is no server: the hash never leaves the browser, and anyone
 * who opens the link on a host running this app gets a copy of the design.
 */

export const SHARE_HASH_PREFIX = 'share=';
/** Guards against gzip bombs in links from strangers */
const MAX_SHARED_BYTES = 20 * 1024 * 1024;

async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SHARED_BYTES) {
      await reader.cancel();
      throw new Error('Thiết kế trong link quá lớn.');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): Uint8Array<ArrayBuffer> {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/** Link that reopens `doc` in this app; `baseUrl` is normally window.location.href */
export async function buildShareUrl(doc: PenDocument, baseUrl: string): Promise<string> {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = SHARE_HASH_PREFIX + toBase64Url(await gzip(serializePenDocument(doc)));
  return url.toString();
}

/**
 * Reads a document from a share-link hash. Null when the hash is not a share
 * link; throws when it is one but the payload is corrupt or not a valid design.
 */
export async function readSharedDocument(hash: string): Promise<PenDocument | null> {
  const fragment = hash.replace(/^#/, '');
  if (!fragment.startsWith(SHARE_HASH_PREFIX)) return null;
  const json = await gunzip(fromBase64Url(fragment.slice(SHARE_HASH_PREFIX.length)));
  return deserializePenDocument(json);
}
