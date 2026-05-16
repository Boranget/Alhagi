import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'

export type ExportFormat = 'html' | 'pdf' | 'txt'

export interface ExportOptions {
  format: ExportFormat
  includeStyles?: boolean
  title?: string
  author?: string
}

export function useExport() {
  const tabsStore = useTabsStore()
  const isExporting = ref(false)
  const exportError = ref<string | null>(null)
  
  function markdownToHtml(markdown: string, title?: string): string {
    let html = markdown
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
    
    return html
  }
  
  function wrapHtml(content: string, title?: string, includeStyles = true): string {
    const styles = includeStyles ? `
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
    ` : ''
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || '导出文档'}</title>
  ${styles}
</head>
<body>
  ${content}
</body>
</html>
    `.trim()
  }
  
  async function exportToHtml(options: ExportOptions): Promise<boolean> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      exportError.value = '没有活动标签页'
      return false
    }
    
    isExporting.value = true
    exportError.value = null
    
    try {
      const htmlContent = markdownToHtml(activeTab.content, options.title)
      const fullHtml = wrapHtml(htmlContent, options.title || activeTab.title, options.includeStyles)
      
      if (window.electronAPI) {
        // 通过 Electron 保存文件
        const defaultName = (activeTab.title || '未命名') + '.html'
        const filePath = await window.electronAPI.saveAsFile(fullHtml, defaultName)
        return !!filePath
      } else {
        // 浏览器环境下直接下载
        const blob = new Blob([fullHtml], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (activeTab.title || '导出') + '.html'
        a.click()
        URL.revokeObjectURL(url)
        return true
      }
    } catch (error) {
      exportError.value = `导出失败: ${error}`
      console.error('Export error:', error)
      return false
    } finally {
      isExporting.value = false
    }
  }
  
  async function exportToTxt(options: ExportOptions): Promise<boolean> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      exportError.value = '没有活动标签页'
      return false
    }
    
    isExporting.value = true
    exportError.value = null
    
    try {
      if (window.electronAPI) {
        const defaultName = (activeTab.title || '未命名') + '.txt'
        const filePath = await window.electronAPI.saveAsFile(activeTab.content, defaultName)
        return !!filePath
      } else {
        const blob = new Blob([activeTab.content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = (activeTab.title || '导出') + '.txt'
        a.click()
        URL.revokeObjectURL(url)
        return true
      }
    } catch (error) {
      exportError.value = `导出失败: ${error}`
      console.error('Export error:', error)
      return false
    } finally {
      isExporting.value = false
    }
  }
  
  async function exportToPdf(options: ExportOptions): Promise<boolean> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      exportError.value = '没有活动标签页'
      return false
    }
    
    isExporting.value = true
    exportError.value = null
    
    try {
      // 先导出为 HTML
      const htmlContent = markdownToHtml(activeTab.content, options.title)
      const fullHtml = wrapHtml(htmlContent, options.title || activeTab.title, options.includeStyles)
      
      // 创建临时容器
      const container = document.createElement('div')
      container.innerHTML = fullHtml
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '210mm'
      container.style.padding = '20mm'
      document.body.appendChild(container)
      
      // 打印为 PDF
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(fullHtml)
        printWindow.document.close()
        printWindow.print()
        printWindow.close()
      }
      
      // 清理
      document.body.removeChild(container)
      
      return true
    } catch (error) {
      exportError.value = `导出失败: ${error}`
      console.error('Export error:', error)
      return false
    } finally {
      isExporting.value = false
    }
  }
  
  async function exportDocument(options: ExportOptions): Promise<boolean> {
    switch (options.format) {
      case 'html':
        return await exportToHtml(options)
      case 'pdf':
        return await exportToPdf(options)
      case 'txt':
        return await exportToTxt(options)
      default:
        exportError.value = '不支持的导出格式'
        return false
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
    exportToHtml,
    exportToPdf,
    exportToTxt,
    exportDocument,
    showExportDialog
  }
}
