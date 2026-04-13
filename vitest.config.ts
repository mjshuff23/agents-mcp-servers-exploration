import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['test/setup.ts'],
          globals: true
        }
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['test/setup.ts'],
          globals: true,
          pool: 'forks',
          testTimeout: 30_000
        }
      }
    ]
  }
});
