import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { exec } from 'child_process'

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
  await window.waitForTimeout(3000)
})

test.afterAll(async () => {
  const pid = app.process().pid
  try {
    await Promise.race([
      app.close(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ])
  } catch {
    exec(`taskkill /F /T /PID ${pid}`)
  }
})

// Helper: dispatch editor:showSearch event
async function openSearch(page: Page, showReplace = false) {
  await page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('editor:showSearch', { detail }))
  }, showReplace ? { showReplace: true } : undefined)
  await page.waitForTimeout(500)
}

test.describe('搜索功能', () => {
  test.beforeEach(async () => {
    // Click "新建文件" to create a file so hasOpenFile condition is met
    const newFileBtn = window.getByText('新建文件')
    if (await newFileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newFileBtn.click()
      await window.waitForTimeout(1500)
    }
  })

  test('Ctrl+F 打开搜索栏', async () => {
    await window.keyboard.press('Control+f')
    await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
  })

  test('输入关键词搜索', async () => {
    await window.keyboard.press('Control+f')
    const input = window.locator('.search-input')
    await expect(input).toBeVisible({ timeout: 10000 })
    await input.fill('hello')
    await expect(input).toHaveValue('hello')
  })

  test('Escape 关闭搜索栏', async () => {
    await window.keyboard.press('Control+f')
    await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
    await window.keyboard.press('Escape')
    await expect(window.locator('.search-bar')).not.toBeVisible({ timeout: 5000 })
  })

  test('Ctrl+H 打开替换栏', async () => {
    await window.keyboard.press('Control+h')
    await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
    await expect(window.locator('.replace-input-field')).toBeVisible()
  })
})
