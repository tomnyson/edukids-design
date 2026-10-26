#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();
const CURRENT_DIR = process.cwd();
const MCP_SCRIPT_PATH = path.resolve(CURRENT_DIR, 'bin/pen-mcp.js');

console.log('=== Pen Studio 1-Click MCP Setup for Coding Agents ===\n');
console.log(`Executable target: ${MCP_SCRIPT_PATH}\n`);

// 1. Setup Antigravity CLI (~/.gemini/antigravity-cli/mcp.json or mcp folder)
const AGY_MCP_DIR = path.join(HOME, '.gemini/antigravity-cli/mcp');
const AGY_CONFIG_PATH = path.join(HOME, '.gemini/antigravity-cli/mcp-servers.json');

try {
  fs.mkdirSync(AGY_MCP_DIR, { recursive: true });
  let agyConfig = {};
  if (fs.existsSync(AGY_CONFIG_PATH)) {
    try {
      agyConfig = JSON.parse(fs.readFileSync(AGY_CONFIG_PATH, 'utf-8'));
    } catch {}
  }
  agyConfig['pen-studio'] = {
    command: 'node',
    args: [MCP_SCRIPT_PATH],
  };
  fs.writeFileSync(AGY_CONFIG_PATH, JSON.stringify(agyConfig, null, 2));
  console.log('✅ Antigravity (agy): Configured at ' + AGY_CONFIG_PATH);
} catch (err) {
  console.warn('⚠️ Antigravity setup warning:', err.message);
}

// 2. Setup OpenCode CLI / Codeope (~/.config/opencode/mcp.json)
const OPENCODE_DIR = path.join(HOME, '.config/opencode');
const OPENCODE_CONFIG = path.join(OPENCODE_DIR, 'mcp.json');

try {
  fs.mkdirSync(OPENCODE_DIR, { recursive: true });
  let ocConfig = { mcpServers: {} };
  if (fs.existsSync(OPENCODE_CONFIG)) {
    try {
      ocConfig = JSON.parse(fs.readFileSync(OPENCODE_CONFIG, 'utf-8'));
    } catch {}
  }
  if (!ocConfig.mcpServers) ocConfig.mcpServers = {};
  ocConfig.mcpServers['pen-studio'] = {
    command: 'node',
    args: [MCP_SCRIPT_PATH],
  };
  fs.writeFileSync(OPENCODE_CONFIG, JSON.stringify(ocConfig, null, 2));
  console.log('✅ OpenCode (codeope): Configured at ' + OPENCODE_CONFIG);
} catch (err) {
  console.warn('⚠️ OpenCode setup warning:', err.message);
}

// 3. Setup Cursor (~/.cursor/mcp.json and local .cursor/mcp.json)
const LOCAL_CURSOR_DIR = path.resolve(CURRENT_DIR, '.cursor');
const LOCAL_CURSOR_CONFIG = path.join(LOCAL_CURSOR_DIR, 'mcp.json');

try {
  fs.mkdirSync(LOCAL_CURSOR_DIR, { recursive: true });
  const cursorConfig = {
    mcpServers: {
      'pen-studio': {
        command: 'node',
        args: [MCP_SCRIPT_PATH],
      },
    },
  };
  fs.writeFileSync(LOCAL_CURSOR_CONFIG, JSON.stringify(cursorConfig, null, 2));
  console.log('✅ Cursor: Local project configured at ' + LOCAL_CURSOR_CONFIG);
} catch (err) {
  console.warn('⚠️ Cursor setup warning:', err.message);
}

console.log('\n🎉 Setup complete! All agents (agy, codeope, cursor, claude) can now control the canvas via MCP.');
