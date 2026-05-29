import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '..',
    emptyOutDir: false,
    lib: {
      entry: 'src/recorder.ts',
      name: 'dotgitRecorder',
      formats: ['iife'],
      fileName: () => 'recorder.js',
    },
  },
});
