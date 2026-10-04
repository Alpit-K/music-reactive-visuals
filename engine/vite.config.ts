import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The Python server (server/serve.py) owns /log and /quit in every mode; in dev Vite forwards to it.
export default defineConfig({
  server: { proxy: { '/log': 'http://localhost:8765', '/quit': 'http://localhost:8765' } },
  build: {
    rollupOptions: {
      input: { wall: resolve(import.meta.dirname, 'index.html'), curate: resolve(import.meta.dirname, 'curate.html') },
    },
  },
});
