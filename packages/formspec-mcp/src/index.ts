#!/usr/bin/env node
/** @filedesc CLI entry point for the Formspec MCP server. */
import { main } from './server.js';

process.on('uncaughtException', (err) => {
  console.error('[formspec-mcp] Uncaught exception:', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[formspec-mcp] Unhandled rejection:', reason);
});

console.error('[formspec-mcp] Starting...');

main()
  .then(() => {
    console.error('[formspec-mcp] Server connected, waiting for messages');
  })
  .catch((err) => {
    console.error('[formspec-mcp] Fatal:', err);
    process.exit(1);
  });
