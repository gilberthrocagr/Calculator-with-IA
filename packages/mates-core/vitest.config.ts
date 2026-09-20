import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // La bateria completa entra de sobra; si algo tarda mas es que se colgo.
    testTimeout: 30000,
    reporters: ['default'],
  },
});
