import { app, BrowserWindow, dialog, shell } from 'electron';
import { execFileSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import type { Server } from 'node:http';
import path from 'node:path';
import { bridgeMiddleware } from '../server/claude-bridge-plugin';
import { BRAND } from '../src/lib/brand';
import { DESKTOP_HOST, DESKTOP_PORT, startAppServer } from './app-server';
import { extendedPath, parseShellPath, resolveClaudeBin, shellPathCommand } from './cli-path';

/**
 * Desktop shell: serves the built web app and the Claude CLI bridge from a
 * local server, and shows it in one window. The page gets no Node access.
 */

const APP_ORIGIN = `http://${DESKTOP_HOST}:${DESKTOP_PORT}`;
const WINDOW_BACKGROUND = '#0c0d12';
/** A slow shell profile must not hold up the window for long */
const SHELL_PATH_TIMEOUT_MS = 3000;

let mainWindow: BrowserWindow | null = null;
let server: Server | null = null;

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** PATH as the user's login shell builds it (nvm, asdf, volta...), or '' when it cannot be read */
function readLoginShellPath(): string {
  const shell = process.env.SHELL;
  if (!shell) return '';
  try {
    const output = execFileSync(shell, ['-ilc', shellPathCommand()], {
      encoding: 'utf8',
      timeout: SHELL_PATH_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return parseShellPath(output);
  } catch {
    // Broken or slow profile: the usual install folders are still searched
    return '';
  }
}

/** An app opened from Finder has no shell PATH; without this the bridge cannot find `claude` or `node` */
function prepareCliEnvironment(): void {
  const shellPath = readLoginShellPath();
  const claude = resolveClaudeBin(process.env, isExecutable, shellPath);
  process.env.PATH = extendedPath(process.env, shellPath);
  // Not found is not fatal: the app reports the missing CLI in chat and offers the API key instead
  if (claude) process.env.CLAUDE_CLI_PATH = claude;
}

function isAppUrl(url: string): boolean {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

/** Web links leave the app for the user's browser; nothing else is ever opened */
function openExternally(url: string): void {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'http:' || protocol === 'https:') void shell.openExternal(url);
  } catch {
    // Not a URL: ignore
  }
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: BRAND.name,
    backgroundColor: WINDOW_BACKGROUND,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternally(url);
  });
  // The page blocks unload while a design is unsaved; Electron would then refuse to close silently
  window.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['Ở lại', 'Đóng không lưu'],
      defaultId: 0,
      cancelId: 0,
      message: 'Thiết kế có thay đổi chưa lưu.',
      detail: 'Đóng cửa sổ sẽ bỏ các thay đổi chưa lưu.',
    });
    // preventDefault here means "ignore the page's objection", i.e. let it close
    if (choice === 1) event.preventDefault();
  });
  window.on('closed', () => {
    mainWindow = null;
  });

  void window.loadURL(`${APP_ORIGIN}/`);
  return window;
}

function describeStartError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'EADDRINUSE') {
    return `Cổng ${DESKTOP_PORT} đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi mở lại ${BRAND.name}.`;
  }
  return `Không khởi động được ${BRAND.name}: ${error instanceof Error ? error.message : String(error)}`;
}

async function start(): Promise<void> {
  prepareCliEnvironment();
  try {
    server = await startAppServer({ distDir: path.join(app.getAppPath(), 'dist'), bridge: bridgeMiddleware });
  } catch (error) {
    dialog.showErrorBox(BRAND.name, describeStartError(error));
    app.exit(1);
    return;
  }
  mainWindow = createWindow();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName(BRAND.name);
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on('window-all-closed', () => {
    server?.close();
    app.quit();
  });
  void app.whenReady().then(start);
}
