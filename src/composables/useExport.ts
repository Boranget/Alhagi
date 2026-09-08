import { useTabsStore } from '@/stores/tabs'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { useSelectDialog } from '@/composables/useSelectDialog'
import { xssSanitizer } from '@/services/xssSanitizer'

export function useExport() {
  const tabsStore = useTabsStore()
  const editorManager = useCrepeEditorManager()
  const selectDialog = useSelectDialog()

  function getFullHtml(title: string): string {
    let content = ''
    try {
      content = editorManager.getHTML()
    } catch (error) {
      content = ''
    }

    if (!content && tabsStore.activeTab) {
      content = `<div class="markdown-body">${tabsStore.activeTab.content}</div>`
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${xssSanitizer.escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
    pre { background: #f4f4f4; padding: 16px; overflow-x: auto; border-radius: 4px; }
    img { max-width: 100%; }
    a { color: #0066cc; }
  </style>
</head>
<body>
${content}
</body>
</html>`
  }

  function exportFile(content: string, title: string, format: 'md' | 'html' | 'txt') {
    let exportContent = content
    let mimeType = 'text/markdown'
    let extension = '.md'

    if (format === 'html') {
      exportContent = getFullHtml(title)
      mimeType = 'text/html'
      extension = '.html'
    } else if (format === 'txt') {
      exportContent = content
      mimeType = 'text/plain'
      extension = '.txt'
    }

    const blob = new Blob([exportContent], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    const baseName = title.replace(/\.md$/, '')
    a.href = url
    a.download = `${baseName}${extension}`
    a.click()

    URL.revokeObjectURL(url)
  }

  async function showExportDialog() {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return

    const exportOptions = [
      { label: 'Markdown (.md)', value: 'md' },
      { label: 'HTML (.html)', value: 'html' },
      { label: 'Plain Text (.txt)', value: 'txt' }
    ]

    const selectedValue = await selectDialog.select({
      title: '选择导出格式',
      options: exportOptions,
    })

    if (selectedValue) {
      exportFile(activeTab.content, activeTab.title, selectedValue as 'md' | 'html' | 'txt')
    }
  }

  return {
    showExportDialog,
    exportFile,
    getFullHtml
  }
}
