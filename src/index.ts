#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseConfig } from './config.js';
import { createServer } from './server.js';

async function main() {
  const config = parseConfig({});
  const { server, browserManager } = createServer(config);

  // Graceful shutdown
  const shutdown = async () => {
    await browserManager.shutdown();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  if (config.transport === 'http') {
    const { default: express } = await import('express');
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const { randomUUID } = await import('node:crypto');

    const app = express();
    app.use(express.json());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const sessionServer = createServer(config);
      await sessionServer.server.connect(transport);

      transport.onclose = () => {
        sessions.delete(transport.sessionId!);
      };
      sessions.set(transport.sessionId!, transport);

      await transport.handleRequest(req, res, req.body);
    });

    app.listen(config.httpPort, () => {
      console.error(`mcp-animation-inspector: HTTP server on port ${config.httpPort}`);
    });
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('mcp-animation-inspector: running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
