# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search.spec.ts >> 搜索功能 >> Ctrl+H 打开替换栏
- Location: tests\e2e\search.spec.ts:69:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.replace-input-field')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.replace-input-field') with timeout 5000ms
  - waiting for locator('.replace-input-field')

```

```yaml
- button "文件资源管理器":
  - img
- button "最近文件":
  - img
- button "搜索":
  - img
- button "文档大纲":
  - img
- button "设置":
  - img
- text: 文件浏览器
- button "新建文件":
  - img
- button "新建文件夹":
  - img
- button "刷新":
  - img
- button "打开文件夹"
- paragraph: 点击"打开文件夹"开始
- text: 未命名
- button:
  - img
- button:
  - img
- img
- img
- textbox "搜索..."
- text: Aa Ab .*
- button [disabled]:
  - img
- button [disabled]:
  - img
- button "关闭":
  - img
- textbox:
  - paragraph: Please enter...
- button "切换侧边栏":
  - img
- button "WYSIWYG 模式":
  - img
- img
- text: "0"
- button "打字机模式":
  - img
- button "专注模式":
  - img
- button "切换主题":
  - img
- img
- text: 100%
```

# Test source

```ts
  1  | import { test, expect, _electron as electron } from '@playwright/test'
  2  | import type { ElectronApplication, Page } from '@playwright/test'
  3  | import { exec } from 'child_process'
  4  | 
  5  | let app: ElectronApplication
  6  | let window: Page
  7  | 
  8  | test.beforeAll(async () => {
  9  |   app = await electron.launch({
  10 |     args: ['.'],
  11 |     timeout: 15000,
  12 |     env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
  13 |   })
  14 |   window = await app.firstWindow()
  15 |   await window.waitForLoadState('domcontentloaded')
  16 |   await window.waitForTimeout(3000)
  17 | })
  18 | 
  19 | test.afterAll(async () => {
  20 |   const pid = app.process().pid
  21 |   try {
  22 |     await Promise.race([
  23 |       app.close(),
  24 |       new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
  25 |     ])
  26 |   } catch {
  27 |     exec(`taskkill /F /T /PID ${pid}`)
  28 |   }
  29 | })
  30 | 
  31 | // Helper: dispatch editor:showSearch event
  32 | async function openSearch(page: Page, showReplace = false) {
  33 |   await page.evaluate((detail) => {
  34 |     window.dispatchEvent(new CustomEvent('editor:showSearch', { detail }))
  35 |   }, showReplace ? { showReplace: true } : undefined)
  36 |   await page.waitForTimeout(500)
  37 | }
  38 | 
  39 | test.describe('搜索功能', () => {
  40 |   test.beforeEach(async () => {
  41 |     // Click "新建文件" to create a file so hasOpenFile condition is met
  42 |     const newFileBtn = window.getByText('新建文件')
  43 |     if (await newFileBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  44 |       await newFileBtn.click()
  45 |       await window.waitForTimeout(1500)
  46 |     }
  47 |   })
  48 | 
  49 |   test('Ctrl+F 打开搜索栏', async () => {
  50 |     await window.keyboard.press('Control+f')
  51 |     await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
  52 |   })
  53 | 
  54 |   test('输入关键词搜索', async () => {
  55 |     await window.keyboard.press('Control+f')
  56 |     const input = window.locator('.search-input')
  57 |     await expect(input).toBeVisible({ timeout: 10000 })
  58 |     await input.fill('hello')
  59 |     await expect(input).toHaveValue('hello')
  60 |   })
  61 | 
  62 |   test('Escape 关闭搜索栏', async () => {
  63 |     await window.keyboard.press('Control+f')
  64 |     await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
  65 |     await window.keyboard.press('Escape')
  66 |     await expect(window.locator('.search-bar')).not.toBeVisible({ timeout: 5000 })
  67 |   })
  68 | 
  69 |   test('Ctrl+H 打开替换栏', async () => {
  70 |     await window.keyboard.press('Control+h')
  71 |     await expect(window.locator('.search-bar')).toBeVisible({ timeout: 10000 })
> 72 |     await expect(window.locator('.replace-input-field')).toBeVisible()
     |                                                          ^ Error: expect(locator).toBeVisible() failed
  73 |   })
  74 | })
  75 | 
```