import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    trace: 'on-first-retry'
  },
  webServer: {
    // Reset the local data dir so prompt-catalog and recipe assertions stay deterministic.
    command: "rm -rf .studio-data/e2e && AGENTS_DATA_DIR=.studio-data/e2e AGENTS_STUDIO_PORT=4322 npm run dev",
    url: 'http://127.0.0.1:4322',
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'pipe'
  }
});
