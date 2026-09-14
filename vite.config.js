import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/creative-tech-portfolio/',
  build: {
    rollupOptions: {
      input: {
        hub: resolve(root, 'index.html'),
        hologram: resolve(root, 'projects/xotrii-hologram/index.html'),
        voicebridge: resolve(root, 'projects/voicebridge-ai/index.html'),
        shiftlens: resolve(root, 'projects/shiftlens-ai/index.html'),
        sonicscope: resolve(root, 'projects/sonicscope-ai/index.html'),
        designguard: resolve(root, 'projects/designguard-ai/index.html')
      }
    }
  }
});