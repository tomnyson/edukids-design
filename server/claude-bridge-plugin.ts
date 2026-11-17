import { spawn, execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { CLAUDE_BRIDGE_ROUTES, BridgeStatus } from '../src/lib/claude-bridge';
import { buildCliInvocation, parseBridgeRequest, parseCliResult } from './claude-cli';

/**
 * Lets the browser generate designs through the locally installed `claude` CLI,
 * using the user's Claude Code login instead of an API key (like pen.dev does).
 * Only loopback, same-origin JSON requests are served: the dev server listens on
 * the LAN (host: true) and every run spends the user's subscription.
 */

/** Read on every call: the desktop app resolves the CLI's location after this module loads */
export function claudeBin(): string {
  return process.env.CLAUDE_CLI_PATH || 'claude';
}
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const RUN_TIMEOUT_MS = 10 * 60_000;
const VERSION_TIMEOUT_MS = 15_000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

const LOCAL_HOST_HEADER = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isTrustedRequest(req: IncomingMessage): boolean {
  if (!LOOPBACK.has(req.socket.remoteAddress ?? '')) return false;
  // DNS rebinding: a hostile domain resolving to 127.0.0.1 still carries its own Host header
  if (!LOCAL_HOST_HEADER.test(req.headers.host ?? '')) return false;
  // Blocks cross-site pages in the user's browser from spending their quota
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`) return false;
  return true;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Yêu cầu quá lớn.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Without ANTHROPIC_API_KEY the CLI bills the logged-in subscription, not a stray key */
function cliEnv(): NodeJS.ProcessEnv {
  const { ANTHROPIC_API_KEY: _ignored, ...env } = process.env;
  return env;
}

let cachedVersion: string | null = null;

function readCliVersion(): Promise<BridgeStatus> {
  if (cachedVersion) return Promise.resolve({ available: true, version: cachedVersion });
  return new Promise((resolve) => {
    execFile(claudeBin(), ['--version'], { timeout: VERSION_TIMEOUT_MS, env: cliEnv() }, (err, stdout) => {
      if (err) {
        resolve({ available: false, error: describeSpawnError(err) });
        return;
      }
      cachedVersion = stdout.trim();
      resolve({ available: true, version: cachedVersion });
    });
  });
}

function describeSpawnError(err: Error & { code?: unknown }): string {
  return err.code === 'ENOENT'
    ? 'Chưa cài Claude Code CLI (lệnh `claude` không có trong PATH).'
    : `Không chạy được Claude CLI: ${err.message}`;
}

function runClaude(args: string[], stdin: string, res: ServerResponse): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin(), args, { cwd: tmpdir(), env: cliEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    // Stop burning quota when the browser tab goes away mid-run
    const abort = () => child.kill('SIGTERM');
    res.on('close', abort);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    child.on('error', (err) => {
      clearTimeout(timer);
      res.off('close', abort);
      reject(new Error(describeSpawnError(err)));
    });
    child.on('close', (_code, signal) => {
      clearTimeout(timer);
      res.off('close', abort);
      if (signal === 'SIGTERM' && !stdout.includes('"type":"result"')) {
        reject(new Error('Claude CLI quá thời gian hoặc bị huỷ.'));
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.on('error', () => {
      // The child exited before reading stdin; the close handler reports why
    });
    child.stdin.end(stdin);
  });
}

async function handleDesign(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST' || !req.headers['content-type']?.includes('application/json')) {
    sendJson(res, 405, { ok: false, error: 'Chỉ nhận POST application/json.' });
    return;
  }
  try {
    const request = parseBridgeRequest(JSON.parse(await readBody(req)));
    const { args, stdin } = buildCliInvocation(request);
    const { stdout, stderr } = await runClaude(args, stdin, res);
    sendJson(res, 200, { ok: true, message: parseCliResult(stdout, stderr, request.tools[0].name) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    console.error('[claude-bridge]', message);
    if (!res.writableEnded) sendJson(res, 502, { ok: false, error: message });
  }
}

/** Serves the bridge routes and passes everything else on; also mounted by the desktop app's server */
export const bridgeMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  const path = req.url?.split('?')[0];
  if (path !== CLAUDE_BRIDGE_ROUTES.status && path !== CLAUDE_BRIDGE_ROUTES.design) {
    next();
    return;
  }
  if (!isTrustedRequest(req)) {
    sendJson(res, 403, { ok: false, available: false, error: 'Chỉ cho phép từ localhost.' });
    return;
  }
  if (path === CLAUDE_BRIDGE_ROUTES.status) {
    readCliVersion().then((status) => sendJson(res, 200, status));
    return;
  }
  void handleDesign(req, res);
};

export function claudeBridgePlugin(): Plugin {
  return {
    name: 'claude-cli-bridge',
    configureServer(server) {
      server.middlewares.use(bridgeMiddleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(bridgeMiddleware);
    },
  };
}
