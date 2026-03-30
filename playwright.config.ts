import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 60_000 },
  use: {
    baseURL: process.env.DEMO_URL || 'https://demo.stubborn.sh',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  retries: 1,
  reporter: 'list',
});
