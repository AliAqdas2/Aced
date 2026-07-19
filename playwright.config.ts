import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'fs';

const WEB_PORT = process.env.WEB_PORT ?? '24285';
const BASE_URL = `http://localhost:${WEB_PORT}`;

// In the Replit NixOS environment the downloaded Playwright chromium binary
// is missing shared libraries (libglib-2.0). A pre-built, working chromium is
// available from the Nix store — use it when present.
const NIX_CHROMIUM =
  '/nix/store/0n9rl5l9syy808xi9bk4f6dhnfrvhkww-playwright-browsers-chromium/chromium-1080/chrome-linux/chrome';

const chromiumExecutablePath = existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial — tests share seeded DB state
  reporter: process.env.CI ? 'github' : 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutablePath ? { launchOptions: { executablePath: chromiumExecutablePath } } : {}),
      },
    },
  ],
});
