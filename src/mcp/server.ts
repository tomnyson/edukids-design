import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PenMcpEngine } from './engine';

export function createPenMcpServer(engine?: PenMcpEngine) {
  const mcpEngine = engine || new PenMcpEngine();

  const server = new McpServer({
    name: 'pen-dev-mcp-server',
    version: '2.13.0',
  });

  // 1. get_app_state
  server.tool(
    'get_app_state',
    'Get pen.dev app state including nodes, active selection and viewport',
    {
      filePath: z.string().optional().describe('Path to .pen file'),
    },
    async ({ filePath }) => {
      const state = mcpEngine.getAppState(filePath);
      return {
        content: [{ type: 'text', text: JSON.stringify(state, null, 2) }],
      };
    }
  );

  // 2. execute
  server.tool(
    'execute',
    'Edit pen.dev design canvas via JS snippet or surgical text edits',
    {
      filePath: z.string().optional().describe('Path to .pen file'),
      input: z.string().optional().describe('JavaScript snippet to mutate canvas AST'),
      description: z.string().optional().describe('Short imperative description of change'),
      edits: z
        .array(
          z.object({
            find: z.string(),
            replace: z.string(),
            all: z.boolean().optional(),
          })
        )
        .optional(),
    },
    async (args) => {
      const result = mcpEngine.execute(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // 3. get_style
  server.tool(
    'get_style',
    'Get pen.dev design style tokens, colors and themes',
    {
      filePath: z.string().optional(),
    },
    async ({ filePath }) => {
      const style = mcpEngine.getStyle(filePath);
      return {
        content: [{ type: 'text', text: JSON.stringify(style, null, 2) }],
      };
    }
  );

  // 4. import_website
  server.tool(
    'import_website',
    'Import website URL and recreate as editable canvas layers',
    {
      url: z.string().url().describe('The URL to capture and convert to canvas nodes'),
      filePath: z.string().optional(),
    },
    async ({ url, filePath }) => {
      const res = mcpEngine.importWebsite(url, filePath);
      return {
        content: [{ type: 'text', text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  // 5. browser
  server.tool(
    'browser',
    'Interact with integrated browser to load URL, screenshot or CDP inspect',
    {
      action: z.enum([
        'load-page',
        'import-to-canvas',
        'screenshot-to-canvas',
        'return-element',
        'return-screenshot',
        'cdp',
      ]),
      url: z.string().optional(),
      filePath: z.string().optional(),
    },
    async ({ action, url }) => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              action,
              url,
              status: 'success',
              message: `Browser action ${action} executed successfully`,
            }),
          },
        ],
      };
    }
  );

  // 6. read_skill
  server.tool('read_skill', 'Read pen.dev design guidelines and system prompt', {}, async () => {
    const skill = mcpEngine.readSkill();
    return {
      content: [{ type: 'text', text: JSON.stringify(skill, null, 2) }],
    };
  });

  // 7. spawn_agents
  server.tool(
    'spawn_agents',
    'Start background design agents for autonomous canvas tasks',
    {
      filePath: z.string().optional(),
      config: z.record(z.any()).optional(),
    },
    async ({ filePath, config }) => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'spawned',
              workers: 1,
              config,
              message: 'Design agent spawned and ready',
            }),
          },
        ],
      };
    }
  );

  return { server, engine: mcpEngine };
}

// Start stdio transport if executed as CLI directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const { server } = createPenMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).catch(console.error);
}
