import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'

export type ExportFormat = 'html' | 'pdf' | 'txt'

export interface ExportOptions {
  format: ExportFormat
  includeStyles?: boolean
  title?: string
  author?: string
}

const HTML_STYLES = `
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 40px auto;
          padding: 20px;
          color: #333;
        }
        h1, h2, h3 { color: #2c3e50; margin-top: 1.5em; }
        code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Fira Code', Consolas, monospace;
        }
        pre {
          background: #f4f4f4;
          padding: 16px;
          border-radius: 6px;
          overflow-x: auto;
        }
        blockquote {
          border-left: 4px solid #3498db;
          padding-left: 16px;
          margin-left: 0;
          color: #7f8c8d;
        }
        img { max-width: 100%; height: auto; }
        a { color: #3498db; }
      </style>
`

function markdownToHtml(markdown: string): string {
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" />')
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n/gim, '<br />')
}

function wrapHtml(content: string, title?: string, includeStyles = true): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || '导出文档'}</title>
  ${includeStyles ? HTML_STYLES : ''}
</head>
<body>
  ${content}
</body>
</html>
  `.trim()
}

function downloadFile(content: string, filename: string, mimeType: string) {
  if (window.electronAPI) {
    return window.electronAPI.saveAsFile(content, filename)
  } else {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return Promise.resolve(filename)
  }
}

type Exporter = (content: string, title: string, options: ExportOptions) => Promise<boolean>

const exporters: Record<ExportFormat, Exporter> = {
  async html(content: string, title: string, options: ExportOptions): Promise<boolean> {
    const htmlContent = markdownToHtml(content)
    const fullHtml = wrapHtml(htmlContent, title, options.includeStyles)
    const filePath = await downloadFile(fullHtml, `${title || '未命名'}.html`, 'text/html')
    return !!filePath
  },
  
  async txt(content: string, title: string): Promise<boolean> {
    const filePath = await downloadFile(content, `${title || '未命名'}.txt`, 'text/plain')
    return !!filePath
  },
  
  async pdf(content: string, title: string, options: ExportOptions): Promise<boolean> {
    const htmlContent = markdownToHtml(content)
    const fullHtml = wrapHtml(htmlContent, title, options.includeStyles)
    
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(fullHtml)
      printWindow.document.close()
      printWindow.print()
      printWindow.close()
      return true
    }
    return false
  }
}

export function useExport() {
  const tabsStore = useTabsStore()
  const isExporting = ref(false)
  const exportError = ref<string | null>(null)
  
  async function exportDocument(options: ExportOptions): Promise<boolean> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      exportError.value = '没有活动标签页'
      return false
    }
    
    isExporting.value = true
    exportError.value = null
    
    try {
      const exporter = exporters[options.format]
      const title = options.title || activeTab.title
      const success = await exporter(activeTab.content, title, options)
      return success
    } catch (error) {
      exportError.value = `导出失败: ${error}`
      console.error('Export error:', error)
      return false
    } finally {
      isExporting.value = false
    }
  }
  
  function showExportDialog() {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      alert('请先打开一个文件')
      return
    }
    
    const format = prompt('选择导出格式 (html/pdf/txt):', 'html')
    if (format) {
      const validFormats: ExportFormat[] = ['html', 'pdf', 'txt']
      if (validFormats.includes(format as ExportFormat)) {
        exportDocument({
          format: format as ExportFormat,
          title: activeTab.title,
          includeStyles: true
        })
      }
    }
  }
  
  return {
    isExporting,
    exportError,
    exportDocument,
    showExportDialog
  }
}
