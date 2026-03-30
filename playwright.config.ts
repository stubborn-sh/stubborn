import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.DEMO_URL || 'https://stubborn-demo.fly.dev',
    screenshot: 'on',
    trace: 'retain-on-failure',
  },
  retries: 1,
  reporter: 'list',
});
