import { defineConfig, devices } from '@playwright/test';

// Las pruebas modifican usuarios en una base compartida: se ejecutan en serie.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080',
    locale: 'es-PE',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'tablet-vertical',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'tablet-horizontal',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 1024 }, hasTouch: true },
    },
  ],
});
