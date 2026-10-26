#!/usr/bin/env node
import { createPenMcpServer } from '../src/mcp/server.ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const { server } = createPenMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Pen MCP Server connected on stdio\n');
}

main().catch((err) => {
  process.stderr.write('Fatal MCP server error: ' + err.message + '\n');
  process.exit(1);
});
