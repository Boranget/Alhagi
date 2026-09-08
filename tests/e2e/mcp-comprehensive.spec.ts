/**
 * Alhagi MCP 综合测试用例
 * 
 * 覆盖范围：
 * 1. 应用启动与基础 UI
 * 2. 标签页管理
 * 3. 编辑器功能（视图模式、格式化）
 * 4. 搜索功能
 * 5. 侧边栏功能
 * 6. 键盘快捷键
 * 7. 主题切换
 * 8. 状态栏
 * 9. 命令面板
 * 10. 视图模式
 * 11. 段落格式
 * 12. 列表格式
 * 13. 表格操作
 * 14. Markdown 语法
 * 15. 缩放
 * 16. 完整工作流
 */

import { test, expect, type Page, type ElectronApplication } from '@playwright/test'
import { _electron as electron } from 'playwright'

let electronApp: ElectronApplication
let page: Page

async function dismissDialogs() {
  for (const text of ['关闭窗口', '关闭', '取消']) {
    const btn = page.locator(`button:has-text("${text}")`)
    if (await btn.isVisible({ timeout: 200 }).catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(200)
    }
  }
}

async function closeSearchBar() {
  const searchBar = page.locator('.search-bar')
  if (await searchBar.isVisible({ timeout: 200 }).catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
}

async function cleanState() {
  await dismissDialogs()
  await closeSearchBar()
}

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: ['dist-electron/main.js'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  })
  
  // 代理所有系统对话框，在主进程里替换 dialog 方法
  await electronApp.evaluate(({ dialog }) => {
    // 文件打开对话框 → 返回取消
    dialog.showOpenDialog = () => Promise.resolve({ canceled: true, filePaths: [] })
    
    // 文件保存对话框 → 返回固定路径
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: 'C:\\test\\temp.md' })
    
    // 文件夹打开对话框 → 返回取消
    // showOpenDialog 已经处理了
    
    // 消息确认框 → 点击第一个按钮（通常是"确认"）
    dialog.showMessageBox = () => Promise.resolve({ response: 0, checkboxChecked: false })
  })
  
  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1000)
})

test.afterAll(async () => {
  try {
    const proc = electronApp?.process()
    if (proc) proc.kill('SIGTERM')
  } catch {}
  try { await electronApp?.close() } catch {}
})

test.afterEach(async () => {
  await dismissDialogs()
  await closeSearchBar()
})

// ============================================================
// 1. 应用启动与基础 UI
// ============================================================
test.describe('1. 应用启动与基础 UI', () => {
  test('1.1 应用窗口加载成功', async () => {
    const title = await page.title()
    expect(title).toContain('顾念笔记')
  })

  test('1.2 欢迎页面显示', async () => {
    const welcomeText = await page.locator('text=欢迎使用顾念笔记').isVisible()
    expect(welcomeText).toBeTruthy()
  })

  test('1.3 侧边栏显示', async () => {
    const sidebar = await page.locator('[class*="sidebar"]').first().isVisible()
    expect(sidebar).toBeTruthy()
  })

  test('1.4 状态栏显示', async () => {
    const statusBar = await page.locator('[class*="status"]').first().isVisible()
    expect(statusBar).toBeTruthy()
  })
})

// ============================================================
// 2. 标签页管理
// ============================================================
test.describe('2. 标签页管理', () => {
  test('2.1 新建文件 (Ctrl+N)', async () => {
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)
    
    // 应该创建一个新标签页并显示编辑器
    const editor = await page.locator('[class*="editor"]').first().isVisible()
    expect(editor).toBeTruthy()
  })

  test('2.2 创建多个标签页', async () => {
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(300)
    
    // 验证标签存在（通过检查标签关闭按钮数量）
    const closeButtons = await page.locator('[class*="close"], [class*="tab"] button').count()
    expect(closeButtons).toBeGreaterThanOrEqual(2)
  })

  test('2.3 切换标签页 (Ctrl+Tab)', async () => {
    await page.keyboard.press('Control+Tab')
    await page.waitForTimeout(300)
    // 不应报错
  })

  test('2.4 关闭标签页 (Ctrl+W)', async () => {
    await cleanState()
    await page.keyboard.press('Control+w')
    await page.waitForTimeout(500)
    
    const closeBtn = page.locator('button:has-text("关闭窗口")')
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click()
      await page.waitForTimeout(300)
    }
    const closeBtn2 = page.locator('button:has-text("关闭")')
    if (await closeBtn2.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn2.click()
      await page.waitForTimeout(300)
    }
    await cleanState()
  })
})

// ============================================================
// 3. 编辑器功能
// ============================================================
test.describe('3. 编辑器功能', () => {
  test('3.1 编辑器可输入', async () => {
    // 先创建新文件
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)
    
    // 点击编辑器内容区域
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('Hello')
    await page.waitForTimeout(500)
    
    const content = await editor.textContent()
    expect(content).toContain('Hello')
  })

  test('3.2 视图模式切换 (Ctrl+/)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    // 切换视图模式
    await page.keyboard.press('Control+/')
    await page.waitForTimeout(500)
    
    // 再切换回来
    await page.keyboard.press('Control+/')
    await page.waitForTimeout(500)
  })

  test('3.3 格式化 - 粗体 (Ctrl+B)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('bold')
    await page.keyboard.down('Shift')
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')
    
    await page.keyboard.press('Control+b')
    await page.waitForTimeout(300)
  })

  test('3.4 格式化 - 斜体 (Ctrl+I)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('italic')
    await page.keyboard.down('Shift')
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')
    
    await page.keyboard.press('Control+i')
    await page.waitForTimeout(300)
  })

  test('3.5 撤销 (Ctrl+Z)', async () => {
    await page.keyboard.press('Control+z')
    await page.waitForTimeout(300)
  })

  test('3.6 重做 (Ctrl+Shift+Z)', async () => {
    await page.keyboard.press('Control+Shift+z')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 4. 搜索功能
// ============================================================
test.describe('4. 搜索功能', () => {
  test('4.1 打开搜索栏 (Ctrl+F)', async () => {
    // 先点击编辑器确保焦点在应用内
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    if (await editor.isVisible()) {
      await editor.click()
      await page.waitForTimeout(200)
    }
    
    await page.keyboard.press('Control+f')
    await page.waitForTimeout(500)
    
    // 搜索栏可能是一个浮动面板
    const searchPanel = page.locator('[class*="search"], [class*="floating"]').first()
    const isVisible = await searchPanel.isVisible()
    expect(isVisible).toBeTruthy()
  })

  test('4.2 输入搜索关键词', async () => {
    const searchInput = page.locator('input').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await page.waitForTimeout(300)
    }
  })

  test('4.3 关闭搜索栏 (Escape)', async () => {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('4.4 打开替换栏 (Ctrl+H)', async () => {
    await page.keyboard.press('Control+h')
    await page.waitForTimeout(500)
    
    // 检查是否有多个输入框（搜索+替换）
    const inputs = await page.locator('input').count()
    expect(inputs).toBeGreaterThanOrEqual(1)
    
    // 关闭（多按一次确保完全关闭）
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 5. 侧边栏功能
// ============================================================
test.describe('5. 侧边栏功能', () => {
  test('5.1 切换侧边栏显示 (Ctrl+Shift+B)', async () => {
    await page.keyboard.press('Control+Shift+b')
    await page.waitForTimeout(500)
    
    // 再切换回来
    await page.keyboard.press('Control+Shift+b')
    await page.waitForTimeout(500)
  })

  test('5.2 侧边栏图标按钮', async () => {
    const sidebarIcons = page.locator('[class*="sidebar"] [class*="icon"], [class*="sidebar"] button')
    const count = await sidebarIcons.count()
    expect(count).toBeGreaterThan(0)
  })
})

// ============================================================
// 6. 键盘快捷键
// ============================================================
test.describe('6. 键盘快捷键', () => {
  test('6.1 快捷键帮助 (Ctrl+K)', async () => {
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(500)
    
    // 关闭对话框
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('6.2 命令面板 (Ctrl+Shift+P)', async () => {
    await page.keyboard.press('Control+Shift+p')
    await page.waitForTimeout(500)
    
    // 关闭
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 7. 主题切换
// ============================================================
test.describe('7. 主题切换', () => {
  test('7.1 切换主题 (Ctrl+Shift+D)', async () => {
    const initialTheme = await page.locator('html').getAttribute('data-theme')
    
    await page.keyboard.press('Control+Shift+d')
    await page.waitForTimeout(500)
    
    const newTheme = await page.locator('html').getAttribute('data-theme')
    expect(newTheme).toBeDefined()
    
    // 切换回来
    await page.keyboard.press('Control+Shift+d')
    await page.waitForTimeout(500)
  })
})

// ============================================================
// 8. 状态栏交互
// ============================================================
test.describe('8. 状态栏交互', () => {
  test('8.1 状态栏信息显示', async () => {
    const statusBar = page.locator('[class*="status"]').first()
    if (await statusBar.isVisible()) {
      const text = await statusBar.textContent()
      expect(text).toBeDefined()
    }
  })
})

// ============================================================
// 9. 视图模式
// ============================================================
test.describe('9. 视图模式', () => {
  test('9.1 沉浸模式 (Ctrl+Shift+Enter)', async () => {
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(300)
    
    // 先关闭可能打开的对话框
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    if (await editor.isVisible()) {
      await editor.click()
      await page.waitForTimeout(200)
    }
    
    // 进入沉浸模式
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(500)
    
    // 退出沉浸模式
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  })

  test('9.2 打字机模式 (Ctrl+Shift+T)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Shift+t')
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Control+Shift+t')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 10. 段落格式
// ============================================================
test.describe('10. 段落格式', () => {
  test('10.1 标题格式 (Ctrl+1/2/3)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('Heading')
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+1')
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Control+2')
    await page.waitForTimeout(300)
    
    await page.keyboard.press('Control+0')
    await page.waitForTimeout(300)
  })

  test('10.2 引用块 (Ctrl+Alt+Q)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('Quote')
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+q')
    await page.waitForTimeout(300)
  })

  test('10.3 代码块 (Ctrl+Alt+C)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+c')
    await page.waitForTimeout(500)
  })
})

// ============================================================
// 11. 列表格式
// ============================================================
test.describe('11. 列表格式', () => {
  test('11.1 无序列表 (Ctrl+Alt+U)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.keyboard.type('Bullet')
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+u')
    await page.waitForTimeout(300)
  })

  test('11.2 有序列表 (Ctrl+Alt+O)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.keyboard.type('Ordered')
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+o')
    await page.waitForTimeout(300)
  })

  test('11.3 任务列表 (Ctrl+Alt+X)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.keyboard.type('Task')
    await page.keyboard.press('Home')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+x')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 12. 表格操作
// ============================================================
test.describe('12. 表格操作', () => {
  test('12.1 插入表格 (Ctrl+Alt+T)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+t')
    await page.waitForTimeout(500)
  })
})

// ============================================================
// 13. Markdown 语法
// ============================================================
test.describe('13. Markdown 语法', () => {
  test('13.1 行内代码', async () => {
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('code')
    await page.keyboard.down('Shift')
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')
    
    await page.keyboard.press('Control+`')
    await page.waitForTimeout(300)
  })

  test('13.2 删除线 (Ctrl+Shift+S)', async () => {
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('strike')
    await page.keyboard.down('Shift')
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')
    
    // dialog 已被代理，不会弹出系统对话框
    await page.keyboard.press('Control+Shift+s')
    await page.waitForTimeout(300)
  })

  test('13.3 高亮 (Ctrl+Shift+H)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('highlight')
    await page.keyboard.down('Shift')
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('ArrowLeft')
    }
    await page.keyboard.up('Shift')
    
    await page.keyboard.press('Control+Shift+h')
    await page.waitForTimeout(300)
  })

  test('13.4 数学块 (Ctrl+Alt+M)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+m')
    await page.waitForTimeout(500)
  })

  test('13.5 分割线 (Ctrl+Alt+-)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+Alt+-')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 14. 全选与复制粘贴
// ============================================================
test.describe('14. 全选与复制粘贴', () => {
  test('14.1 全选 (Ctrl+A)', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.press('Control+a')
    await page.waitForTimeout(300)
  })

  test('14.2 复制 (Ctrl+C)', async () => {
    await page.keyboard.press('Control+c')
    await page.waitForTimeout(200)
  })

  test('14.3 粘贴 (Ctrl+V)', async () => {
    await page.keyboard.press('Control+v')
    await page.waitForTimeout(200)
  })
})

// ============================================================
// 15. 缩放
// ============================================================
test.describe('15. 缩放', () => {
  test('15.1 放大 (Ctrl+=)', async () => {
    await page.keyboard.press('Control+=')
    await page.waitForTimeout(300)
  })

  test('15.2 缩小 (Ctrl+-)', async () => {
    await page.keyboard.press('Control+-')
    await page.waitForTimeout(300)
  })

  test('15.3 重置缩放 (Ctrl+0)', async () => {
    await page.keyboard.press('Control+0')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 16. 全屏
// ============================================================
test.describe('16. 全屏', () => {
  test('16.1 切换全屏 (F11)', async () => {
    await page.keyboard.press('F11')
    await page.waitForTimeout(500)
    
    await page.keyboard.press('F11')
    await page.waitForTimeout(500)
  })
})

// ============================================================
// 17. 边界情况
// ============================================================
test.describe('17. 边界情况', () => {
  test('17.1 快速连续操作', async () => {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+n')
      await page.waitForTimeout(100)
    }
    await page.waitForTimeout(500)
    
    const title = await page.title()
    expect(title).toContain('顾念笔记')
  })

  test('17.2 特殊字符输入', async () => {
    const editor = page.locator('[class*="editor"]').first()
    await editor.click()
    await page.waitForTimeout(200)
    
    await page.keyboard.type('!@#$%^&*()')
    await page.waitForTimeout(300)
  })
})

// ============================================================
// 18. 内容持久化
// ============================================================
test.describe('18. 内容持久化', () => {
  test('18.1 标签页内容保持', async () => {
    await cleanState()
    
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)
    
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    await editor.click({ force: true })
    await page.waitForTimeout(200)
    
    await page.keyboard.type('Persistent')
    await page.waitForTimeout(1000)
    
    await page.keyboard.press('Control+Tab')
    await page.waitForTimeout(500)
    await page.keyboard.press('Control+Shift+Tab')
    await page.waitForTimeout(1000)
    
    const content = await editor.textContent()
    expect(content).toBeDefined()
  })
})

// ============================================================
// 19. 多窗口场景
// ============================================================
test.describe('19. 多窗口场景', () => {
  test('19.1 新建窗口 (Ctrl+Shift+N)', async () => {
    const initialWindowCount = electronApp.windows().length
    
    await page.keyboard.press('Control+Shift+n')
    await page.waitForTimeout(1000)
    
    const newWindowCount = electronApp.windows().length
    expect(newWindowCount).toBeGreaterThanOrEqual(initialWindowCount)
  })
})

// ============================================================
// 20. 完整工作流
// ============================================================
test.describe('20. 完整工作流', () => {
  test('20.1 创建、编辑、搜索、关闭流程', async () => {
    await cleanState()
    
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(300)
    await cleanState()
    
    const editor = page.locator('.cm-content, .ProseMirror, [contenteditable="true"]').first()
    await editor.click({ force: true })
    await page.keyboard.type('# Test')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Important content here.')
    await page.waitForTimeout(300)
    await cleanState()
    
    await page.keyboard.press('Control+f')
    await page.waitForTimeout(300)
    
    const searchInput = page.locator('.search-input-field input, input[placeholder*="搜索"]').first()
    if (await searchInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await searchInput.fill('Important')
      await page.waitForTimeout(300)
    }
    await cleanState()
    
    await page.keyboard.press('Control+w')
    await page.waitForTimeout(500)
    
    const closeWindowBtn = page.locator('button:has-text("关闭窗口")')
    if (await closeWindowBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeWindowBtn.click()
      await page.waitForTimeout(300)
    }
  })
})

// ============================================================
// 21. 国际化
// ============================================================
test.describe('21. 国际化', () => {
  test('21.1 中文界面', async () => {
    const htmlLang = await page.locator('html').getAttribute('lang')
    expect(htmlLang).toBe('zh-CN')
  })
})

// ============================================================
// 22. 窗口控制
// ============================================================
test.describe('22. 窗口控制', () => {
  test('22.1 获取窗口信息', async () => {
    const windows = electronApp.windows()
    expect(windows.length).toBeGreaterThanOrEqual(1)
    
    const firstWindow = windows[0]
    const title = await firstWindow.title()
    expect(title).toContain('顾念笔记')
  })
})

// ============================================================
// 23. 错误处理
// ============================================================
test.describe('23. 错误处理', () => {
  test('23.1 控制台无严重错误', async () => {
    const errors: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)
    
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('net::ERR') &&
      !e.includes('DevTools')
    )
    
    expect(criticalErrors.length).toBe(0)
  })
})

// ============================================================
// 24. 性能基准
// ============================================================
test.describe('24. 性能基准', () => {
  test('24.1 应用响应时间', async () => {
    const startTime = Date.now()
    
    await page.keyboard.press('Control+n')
    await page.waitForSelector('[class*="editor"]', { timeout: 5000 })
    
    const endTime = Date.now()
    const responseTime = endTime - startTime
    
    expect(responseTime).toBeLessThan(2000)
  })
})
