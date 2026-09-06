# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: search.spec.ts >> 搜索功能 >> 输入关键词搜索
- Location: tests\e2e\search.spec.ts:54:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.search-input')
Expected: visible
Error: strict mode violation: locator('.search-input') resolved to 2 elements:
    1) <input type="text" data-v-bd2dce9b="" placeholder="搜索..." class="search-input"/> aka getByPlaceholder('搜索').first()
    2) <input type="text" data-v-666d07e3="" placeholder="搜索..." class="search-input"/> aka getByRole('textbox', { name: '搜索' })

Call log:
  - Expect "toBeVisible" locator('.search-input') with timeout 10000ms
  - waiting for locator('.search-input')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e4]:
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - generic [ref=f1e7]:
          - button "文件资源管理器" [ref=f1e8] [cursor=pointer]
          - button "最近文件" [ref=f1e11] [cursor=pointer]
          - button "搜索" [ref=f1e15] [cursor=pointer]
          - button "文档大纲" [ref=f1e19] [cursor=pointer]
        - button "设置" [ref=f1e24] [cursor=pointer]
      - generic [ref=f1e29]:
        - generic [ref=f1e30]:
          - generic [ref=f1e31]: 文件浏览器
          - generic [ref=f1e32]:
            - button "新建文件" [ref=f1e33] [cursor=pointer]
            - button "新建文件夹" [ref=f1e37] [cursor=pointer]
            - button "刷新" [ref=f1e40] [cursor=pointer]
        - button "打开文件夹" [ref=f1e46] [cursor=pointer]
        - paragraph [ref=f1e48]: 点击"打开文件夹"开始
    - generic [ref=f1e50]:
      - generic [ref=f1e51]:
        - generic [ref=f1e53] [cursor=pointer]:
          - generic [ref=f1e54]: 未命名
          - button [ref=f1e55]
        - button [ref=f1e60] [cursor=pointer]
      - generic [ref=f1e64]:
        - generic [ref=f1e65]:
          - generic [ref=f1e66] [cursor=pointer]
          - generic [ref=f1e69]:
            - generic [ref=f1e70]:
              - generic [ref=f1e71]:
                - textbox "搜索..." [active] [ref=f1e72]
                - generic [ref=f1e73]:
                  - generic "区分大小写" [ref=f1e74] [cursor=pointer]: Aa
                  - generic "全字匹配" [ref=f1e75] [cursor=pointer]: Ab
                  - generic "正则表达式" [ref=f1e76] [cursor=pointer]: .*
              - generic [ref=f1e77]:
                - button [disabled] [ref=f1e78]
                - button [disabled] [ref=f1e81]
            - button "关闭" [ref=f1e84] [cursor=pointer]
        - textbox [ref=f1e90]:
          - paragraph [ref=f1e91]: Please enter...
  - generic [ref=f1e92]:
    - generic [ref=f1e93]:
      - button "切换侧边栏" [ref=f1e94] [cursor=pointer]
      - button "WYSIWYG 模式" [ref=f1e97] [cursor=pointer]
    - generic [ref=f1e101]:
      - generic "原始 Markdown 字符数" [ref=f1e102] [cursor=pointer]: "0"
      - button "打字机模式" [ref=f1e107] [cursor=pointer]
      - button "专注模式" [ref=f1e110] [cursor=pointer]
      - button "切换主题" [ref=f1e115] [cursor=pointer]
      - generic "statusBar.zoomLevel" [ref=f1e118]: 100%
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
> 57 |     await expect(input).toBeVisible({ timeout: 10000 })
     |                         ^ Error: expect(locator).toBeVisible() failed
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
  72 |     await expect(window.locator('.replace-input-field')).toBeVisible()
  73 |   })
  74 | })
  75 | 
```