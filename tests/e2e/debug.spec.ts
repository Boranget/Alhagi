import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

let app: ElectronApplication
let window: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['.'],
    timeout: 15000,
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  })
  window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForTimeout(5000)
})

test.afterAll(async () => {
  const pid = app.process().pid
  try {
    await Promise.race([
      app.close(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ])
  } catch {
    const { exec } = await import('child_process')
    exec(`taskkill /F /T /PID ${pid}`)
  }
})

test('截图看应用状态', async () => {
  await window.screenshot({ path: 'test-results/app-state.png', fullPage: true })
  const html = await window.content()
  console.log('=== PAGE HTML (first 3000 chars) ===')
  console.log(html.substring(0, 3000))
  console.log('=== END HTML ===')
})
