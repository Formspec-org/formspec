#!/usr/bin/env node
/** @filedesc CLI entry point for the Formspec MCP server. */
import { main } from './server.js';

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
