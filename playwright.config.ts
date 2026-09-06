import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  retries: 0,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
  },
})
