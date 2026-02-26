import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 8081,
    host: '0.0.0.0',
    allowedHosts: ['ice-badger.exe.xyz']
  }
});
