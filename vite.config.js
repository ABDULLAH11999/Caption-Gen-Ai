import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    open: false,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true
      },
      '/sitemap.xml': {
        target: 'http://localhost:10000',
        changeOrigin: true
      }
    },
    watch: {
      ignored: ['**/video-for-testrun/**', '**/node_modules/**', '**/scratch/**']
    }
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 4096
  }
});
