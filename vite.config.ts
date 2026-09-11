import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
