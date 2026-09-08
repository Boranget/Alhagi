import { useTabsStore } from '@/stores/tabs'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { xssSanitizer } from '@/services/xssSanitizer'

export function useClipboard() {
  const editorManager = useCrepeEditorManager()
  const { getMarkdown, getHTML } = editorManager

  function copyAsMarkdown(): boolean {
    const tabs = useTabsStore()
    const activeTab = tabs.activeTab
    
    if (!activeTab) return false
    
    const text = getMarkdown()
    navigator.clipboard.writeText(text).catch(() => {})
    return true
  }

  function copyAsHtml(): boolean {
    const tabs = useTabsStore()
    const activeTab = tabs.activeTab
    
    if (!activeTab) return false
    
    const htmlContent = getHTML()
    const fullHtml = wrapWithHtmlTemplate(htmlContent, activeTab.title)
    
    const blob = new Blob([fullHtml], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({ 'text/html': blob })
    navigator.clipboard.write([clipboardItem]).catch(() => {})
    
    return true
  }

  function wrapWithHtmlTemplate(content: string, title: string): string {
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

  async function pasteAsPlainText(): Promise<boolean> {
    try {
      const text = await navigator.clipboard.readText()
      const cleanText = text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      const activeTab = useTabsStore().activeTab
      if (!activeTab) return false
      
      document.execCommand('insertText', false, cleanText)
      return true
    } catch (e) {
      console.warn('Failed to paste as plain text:', e)
      return false
    }
  }

  return {
    copyAsMarkdown,
    copyAsHtml,
    pasteAsPlainText
  }
}
