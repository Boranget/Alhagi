import { test, expect } from './fixtures'

test.describe('标签页切换内容保留测试', () => {
  test('切换标签页不应丢失内容', async ({ window: page }) => {
    // 等待编辑器加载
    await page.waitForTimeout(2000)

    // 创建第一个标签页并输入内容
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)

    // 点击编辑器区域以确保获得焦点
    const editor = page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first()
    await editor.click()
    await page.waitForTimeout(300)

    // 输入内容
    const testContent1 = '这是标签1的内容'
    await page.keyboard.type(testContent1, { delay: 50 })
    await page.waitForTimeout(500)

    // 创建第二个标签页并输入内容
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)

    // 点击编辑器区域
    const editor2 = page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first()
    await editor2.click()
    await page.waitForTimeout(300)

    // 输入内容
    const testContent2 = '这是标签2的内容'
    await page.keyboard.type(testContent2, { delay: 50 })
    await page.waitForTimeout(500)

    // 切换回第一个标签页 (Ctrl+Shift+Tab)
    await page.keyboard.press('Control+Shift+Tab')
    await page.waitForTimeout(1000)

    // 验证第一个标签页的内容仍然存在
    const content1 = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content1).toContain('标签1')

    // 切换到第二个标签页 (Ctrl+Tab)
    await page.keyboard.press('Control+Tab')
    await page.waitForTimeout(1000)

    // 验证第二个标签页的内容仍然存在
    const content2 = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content2).toContain('标签2')

    // 再切换回第一个标签页验证
    await page.keyboard.press('Control+Shift+Tab')
    await page.waitForTimeout(1000)

    const content1Again = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content1Again).toContain('标签1')
  })

  test('通过 Ctrl+1~9 快速切换标签页不应丢失内容', async ({ window: page }) => {
    // 等待编辑器加载
    await page.waitForTimeout(2000)

    // 创建三个标签页并输入不同内容
    for (let i = 1; i <= 3; i++) {
      await page.keyboard.press('Control+n')
      await page.waitForTimeout(500)

      const editor = page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first()
      await editor.click()
      await page.waitForTimeout(300)

      await page.keyboard.type(`标签${i}的内容`, { delay: 50 })
      await page.waitForTimeout(300)
    }

    // 使用 Ctrl+1 切换到第一个标签
    await page.keyboard.press('Control+1')
    await page.waitForTimeout(1000)

    const content1 = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content1).toContain('标签1')

    // 使用 Ctrl+2 切换到第二个标签
    await page.keyboard.press('Control+2')
    await page.waitForTimeout(1000)

    const content2 = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content2).toContain('标签2')

    // 使用 Ctrl+3 切换到第三个标签
    await page.keyboard.press('Control+3')
    await page.waitForTimeout(1000)

    const content3 = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content3).toContain('标签3')
  })

  test('关闭标签后切换不应丢失其他标签内容', async ({ window: page }) => {
    // 等待编辑器加载
    await page.waitForTimeout(2000)

    // 创建两个标签页并输入内容
    for (let i = 1; i <= 2; i++) {
      await page.keyboard.press('Control+n')
      await page.waitForTimeout(500)

      const editor = page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first()
      await editor.click()
      await page.waitForTimeout(300)

      await page.keyboard.type(`保留内容${i}`, { delay: 50 })
      await page.waitForTimeout(300)
    }

    // 切换回第一个标签
    await page.keyboard.press('Control+Shift+Tab')
    await page.waitForTimeout(500)

    // 再创建一个临时标签
    await page.keyboard.press('Control+n')
    await page.waitForTimeout(500)

    const editor = page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first()
    await editor.click()
    await page.waitForTimeout(300)

    await page.keyboard.type('临时内容', { delay: 50 })
    await page.waitForTimeout(300)

    // 关闭当前标签 (Ctrl+W)
    await page.keyboard.press('Control+w')
    await page.waitForTimeout(500)

    // 如果出现确认对话框（有未保存内容时），点击"关闭"按钮
    const confirmBtn = page.locator('.confirm-dialog button.confirm')
    if (await confirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmBtn.click()
      await page.waitForTimeout(500)
    }

    // 验证剩余标签的内容
    const content = await page.locator('.ProseMirror, .cm-content, [contenteditable="true"]').first().textContent()
    expect(content).toBeTruthy()
    expect(content).not.toContain('临时内容')
  })
})
