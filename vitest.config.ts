import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Unit tests cover shared contracts plus the repo's documentation spine.
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['test/setup.ts'],
          globals: true
        }
      },
      {
        test: {
          // Integration tests boot the real MCP server over stdio.
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
