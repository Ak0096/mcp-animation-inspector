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
    // HTTP transport — Task 13
    console.error(`HTTP transport not yet implemented. Use stdio.`);
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('mcp-animation-inspector: running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
