import { useTabsStore } from '@/stores/tabs'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'

export function useExport() {
  const tabsStore = useTabsStore()
  const editorManager = useCrepeEditorManager()

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function getFullHtml(title: string): string {
    let content = ''
    try {
      content = editorManager.getHTML()
    } catch (error) {
      console.error('[useExport] Failed to get HTML content for export:', error)
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
  <title>${escapeHtml(title)}</title>
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

  function showExportDialog() {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return

    const exportOptions = [
      { label: 'Markdown (.md)', value: 'md' },
      { label: 'HTML (.html)', value: 'html' },
      { label: 'Plain Text (.txt)', value: 'txt' }
    ]

    const selectedOption = prompt(
      '选择导出格式：\n' + exportOptions.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n'),
      '1'
    )

    if (!selectedOption) return

    const optionIndex = parseInt(selectedOption) - 1
    if (optionIndex >= 0 && optionIndex < exportOptions.length) {
      const option = exportOptions[optionIndex]
      exportFile(activeTab.content, activeTab.title, option.value as 'md' | 'html' | 'txt')
    }
  }

  return {
    showExportDialog,
    exportFile,
    getFullHtml
  }
}
