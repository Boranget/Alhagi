import { useTabsStore } from '@/stores/tabs'
import { EDITOR } from '@/constants'

export function useClipboard() {
  function copyAsMarkdown(): boolean {
    const tabs = useTabsStore()
    const activeTab = tabs.activeTab
    
    if (!activeTab) return false
    
    const text = activeTab.content
    navigator.clipboard.writeText(text)
    return true
  }

  function copyAsHtml(): boolean {
    const tabs = useTabsStore()
    const activeTab = tabs.activeTab
    
    if (!activeTab) return false
    
    const markdownContent = activeTab.content
    
    const html = convertMarkdownToHtml(markdownContent)
    
    const blob = new Blob([html], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({ 'text/html': blob })
    navigator.clipboard.write([clipboardItem])
    
    return true
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
      console.error('Failed to paste as plain text:', e)
      return false
    }
  }

  return {
    copyAsMarkdown,
    copyAsHtml,
    pasteAsPlainText
  }
}

function convertMarkdownToHtml(markdown: string): string {
  let html = markdown
  
  html = html
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/gim, '<br>')
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
  </style>
</head>
<body>
${html}
</body>
</html>`
}
