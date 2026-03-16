#!/usr/bin/env node
import { main } from './server.js';

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
