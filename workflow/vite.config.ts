import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'workflow.html',
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx,js}', '../lib/**/*.test.js'],
    environment: 'jsdom',
    globals: true,
  },
});
