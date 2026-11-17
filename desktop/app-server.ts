import http, { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * The desktop app's local server: the built web app plus the Claude CLI
 * bridge, on one loopback origin. The port is fixed because localStorage is
 * per origin: a different port each launch would hide the user's saved chats.
 */

export const DESKTOP_HOST = '127.0.0.1';
export const DESKTOP_PORT = 47615;

export type BridgeMiddleware = (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void) => void;

export interface AppServerOptions {
  /** Folder holding the Vite build (index.html, assets/) */
  distDir: string;
  /** Handles /api/claude/*; calls next() for everything else */
  bridge: BridgeMiddleware;
  port?: number;
}

const INDEX_FILE = 'index.html';
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

function sendStatus(res: ServerResponse, status: number): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.end(http.STATUS_CODES[status] ?? '');
}

/**
 * The file a request path names, or null when it is malformed or would leave
 * `distDir`. Paths without an extension are app routes and get index.html.
 */
export function resolveRequestFile(distDir: string, requestUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(requestUrl.split('?')[0].split('#')[0]);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  const root = path.resolve(distDir);
  const target = path.resolve(root, `.${path.sep}${pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return path.extname(target) ? target : path.join(root, INDEX_FILE);
}

async function serveFile(distDir: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('allow', 'GET, HEAD');
    sendStatus(res, 405);
    return;
  }
  const file = resolveRequestFile(distDir, req.url ?? '/');
  const info = file ? await stat(file).catch(() => null) : null;
  if (!file || !info?.isFile()) {
    sendStatus(res, 404);
    return;
  }
  res.statusCode = 200;
  res.setHeader('content-type', CONTENT_TYPES[path.extname(file).toLowerCase()] ?? DEFAULT_CONTENT_TYPE);
  res.setHeader('content-length', info.size);
  res.setHeader('x-content-type-options', 'nosniff');
  // Hashed assets never change; index.html must be re-read after an app update
  res.setHeader('cache-control', path.basename(file) === INDEX_FILE ? 'no-cache' : 'public, max-age=31536000, immutable');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file)
    .on('error', () => sendStatus(res, 404))
    .pipe(res);
}

/** Resolves with the listening server; rejects with the listen error (code 'EADDRINUSE' when the port is taken) */
export function startAppServer(options: AppServerOptions): Promise<http.Server> {
  const { distDir, bridge, port = DESKTOP_PORT } = options;
  const server = http.createServer((req, res) => {
    bridge(req, res, (error) => {
      if (error) {
        sendStatus(res, 500);
        return;
      }
      serveFile(distDir, req, res).catch(() => sendStatus(res, 500));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, DESKTOP_HOST, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}
