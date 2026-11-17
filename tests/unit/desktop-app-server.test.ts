import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DESKTOP_HOST, DESKTOP_PORT, startAppServer } from '../../desktop/app-server';

type Bridge = Parameters<typeof startAppServer>[0]['bridge'];
const pass: Bridge = (_req, _res, next) => next();
const statusBridge: Bridge = (req, res, next) => {
  if (req.url !== '/api/claude/status') return next();
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ available: true }));
};

let root: string;
let distDir: string;
let server: http.Server;
let port: number;

/** fetch() normalises dot segments away, so traversal attempts need a raw request */
function rawGet(targetPort: number, requestPath: string, method = 'GET'): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: DESKTOP_HOST, port: targetPort, path: requestPath, method }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), 'edukids-server-'));
  distDir = path.join(root, 'dist');
  mkdirSync(path.join(distDir, 'assets'), { recursive: true });
  writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>app</title>');
  writeFileSync(path.join(distDir, 'assets', 'app.js'), 'export const ok = true;');
  writeFileSync(path.join(distDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(path.join(root, 'secret.txt'), 'TOP SECRET');
  server = await startAppServer({ distDir, bridge: statusBridge, port: 0 });
  port = (server.address() as AddressInfo).port;
});

afterAll(() => {
  server.close();
  rmSync(root, { recursive: true, force: true });
});

const url = (requestPath: string) => `http://${DESKTOP_HOST}:${port}${requestPath}`;

describe('startAppServer', () => {
  it('uses a fixed loopback address so saved data keeps its origin', () => {
    expect(DESKTOP_HOST).toBe('127.0.0.1');
    expect(DESKTOP_PORT).toBe(47615);
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('serves index.html at the root without caching it', async () => {
    const res = await fetch(url('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(await res.text()).toContain('<title>app</title>');
  });

  it('serves assets with their content type', async () => {
    const js = await fetch(url('/assets/app.js'));
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect(await js.text()).toContain('ok = true');
    expect((await fetch(url('/favicon.svg'))).headers.get('content-type')).toContain('image/svg+xml');
  });

  it('ignores the query string', async () => {
    expect((await fetch(url('/assets/app.js?v=2'))).status).toBe(200);
  });

  it('falls back to index.html for app routes', async () => {
    const res = await fetch(url('/some/route'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>app</title>');
  });

  it('returns 404 for a missing asset', async () => {
    expect((await fetch(url('/assets/nope.js'))).status).toBe(404);
  });

  it('never serves files outside the build folder', async () => {
    const attempts = ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/assets/../../secret.txt'];
    for (const attempt of attempts) {
      const res = await rawGet(port, attempt);
      expect(res.status, attempt).toBe(404);
      expect(res.body, attempt).not.toContain('TOP SECRET');
    }
  });

  it('answers a malformed path with 404 instead of crashing', async () => {
    expect((await rawGet(port, '/%E0%A4%A')).status).toBe(404);
    expect((await fetch(url('/'))).status).toBe(200);
  });

  it('gives the bridge first refusal', async () => {
    const res = await fetch(url('/api/claude/status'));
    expect(await res.json()).toEqual({ available: true });
  });

  it('rejects methods other than GET and HEAD for files', async () => {
    expect((await rawGet(port, '/index.html', 'POST')).status).toBe(405);
    const head = await rawGet(port, '/index.html', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body).toBe('');
  });

  it('rejects when the port is taken', async () => {
    await expect(startAppServer({ distDir, bridge: pass, port })).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});
