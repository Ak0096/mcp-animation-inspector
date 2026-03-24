import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { parseConfig } from './config.js';
import { BrowserManager } from './browser.js';
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

    const sharedBrowser = new BrowserManager(config);

    const app = express();
    app.use(express.json({ limit: '1mb' }));

    app.use((_req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      next();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sessions = new Map<string, InstanceType<typeof StreamableHTTPServerTransport>>();
    const sessionTimestamps = new Map<string, number>();
    const MAX_SESSIONS = 10;
    const SESSION_TTL_MS = 30 * 60 * 1000;

    setInterval(() => {
      const now = Date.now();
      for (const [id, ts] of sessionTimestamps) {
        if (now - ts > SESSION_TTL_MS) {
          const transport = sessions.get(id);
          if (transport) {
            transport.close?.();
            sessions.delete(id);
          }
          sessionTimestamps.delete(id);
        }
      }
    }, 60_000);

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      if (sessionId && sessions.has(sessionId)) {
        const transport = sessions.get(sessionId)!;
        await transport.handleRequest(req, res, req.body);
        return;
      }

      if (sessions.size >= MAX_SESSIONS) {
        res.status(503).json({ error: 'Too many sessions' });
        return;
      }

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      const sessionServer = createServer(config, sharedBrowser);
      await sessionServer.server.connect(transport);

      transport.onclose = () => {
        sessionTimestamps.delete(transport.sessionId!);
        sessions.delete(transport.sessionId!);
      };
      sessions.set(transport.sessionId!, transport);
      sessionTimestamps.set(transport.sessionId!, Date.now());

      await transport.handleRequest(req, res, req.body);
    });

    app.listen(config.httpPort, '127.0.0.1', () => {
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
