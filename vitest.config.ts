import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/tests/**/*.test.ts'],
    exclude: ['node_modules', 'build', 'dist'],
  },
});