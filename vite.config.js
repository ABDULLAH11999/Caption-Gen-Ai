import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
    cors: true
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096
  }
});
