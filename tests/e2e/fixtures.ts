import { test as base, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

// Use args: ['.'] to launch - reads package.json main field → dist-electron/main.js
// Must build before testing: npm run build or vite build

type ElectronFixtures = {
  app: ElectronApplication
  window: Page
}

export const test = base.extend<ElectronFixtures>({
  app: async ({}, use) => {
    const electronApp = await electron.launch({
      args: ['.'],
      timeout: 15000,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: '1',
      },
    })
    // Must await firstWindow before any action
    const win = await electronApp.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await use(electronApp)
    // Force kill on Windows - app has background tasks that prevent clean exit
    try {
      const proc = electronApp.process()
      if (proc && !proc.killed) {
        proc.kill('SIGKILL')
      }
    } catch {}
  },
  window: async ({ app }, use) => {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.waitForTimeout(2000)
    await use(win)
  },
})

export { expect }
