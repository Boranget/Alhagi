import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'

export type ImageInsertMode = 'keep-original' | 'copy-absolute' | 'copy-relative'

export interface ImageInsertOptions {
  mode: ImageInsertMode
  customPath?: string
  useVariables?: boolean
}

export function useImageInsert() {
  const tabsStore = useTabsStore()
  
  const isInserting = ref(false)
  const lastInsertMode = ref<ImageInsertMode>('keep-original')
  
  async function insertImage(file: File): Promise<string | null> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      return null
    }
    
    isInserting.value = true
    
    try {
      let imagePath: string
      let markdown: string
      
      if (lastInsertMode.value === 'keep-original') {
        // 模式1: 保留原始路径
        imagePath = file.name
        markdown = `![${file.name}](${imagePath})`
      } else if (lastInsertMode.value === 'copy-absolute') {
        // 模式2: 复制到指定目录 + 绝对路径
        imagePath = await copyImageToDirectory(file, '')
        markdown = `![${file.name}](${imagePath})`
      } else {
        // 模式3: 复制到指定目录 + 相对路径
        const relativePath = await copyImageRelative(file, activeTab.filePath || '')
        markdown = `![${file.name}](${relativePath})`
      }
      
      // 在当前光标位置插入图片
      insertMarkdownAtCursor(markdown)
      
      // 标记为脏
      tabsStore.updateTab(activeTab.id, {
        isDirty: true,
        lastModified: Date.now()
      })
      
      return markdown
    } catch (error) {
      console.error('Failed to insert image:', error)
      return null
    } finally {
      isInserting.value = false
    }
  }
  
  async function copyImageToDirectory(file: File, directory: string): Promise<string> {
    // 在实际应用中，这里会通过 IPC 调用主进程来复制文件
    // 目前只是模拟返回路径
    if (!directory) {
      // 如果没有指定目录，使用临时目录
      const tempDir = '/tmp/alhagi-images'
      const timestamp = Date.now()
      const newName = `${timestamp}_${file.name}`
      return `${tempDir}/${newName}`
    }
    
    const timestamp = Date.now()
    const newName = `${timestamp}_${file.name}`
    return `${directory}/${newName}`
  }
  
  async function copyImageRelative(file: File, mdFilePath: string): Promise<string> {
    // 计算相对于 MD 文件的路径
    const timestamp = Date.now()
    const newName = `${timestamp}_${file.name}`
    
    // 在实际应用中，这里会通过 IPC 调用主进程来复制文件
    // 并返回相对于 MD 文件的路径
    return `./assets/${newName}`
  }
  
  function insertMarkdownAtCursor(markdown: string) {
    const textarea = document.querySelector('.source-editor, .split-source') as HTMLTextAreaElement
    
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = textarea.value
      
      textarea.value = text.substring(0, start) + markdown + text.substring(end)
      textarea.selectionStart = textarea.selectionEnd = start + markdown.length
      textarea.focus()
      
      // 触发 input 事件以更新 store
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  
  function insertImageByPath(imagePath: string, altText?: string): void {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return
    
    const alt = altText || imagePath.split('/').pop() || 'image'
    const markdown = `![${alt}](${imagePath})`
    
    insertMarkdownAtCursor(markdown)
    
    tabsStore.updateTab(activeTab.id, {
      isDirty: true,
      lastModified: Date.now()
    })
  }
  
  async function selectAndInsertImage(mode: ImageInsertMode = 'keep-original'): Promise<void> {
    lastInsertMode.value = mode
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await insertImage(file)
      }
    }
    
    input.click()
  }
  
  function setInsertMode(mode: ImageInsertMode) {
    lastInsertMode.value = mode
  }
  
  return {
    isInserting,
    lastInsertMode,
    insertImage,
    insertImageByPath,
    selectAndInsertImage,
    setInsertMode,
    ImageInsertMode: {
      KEEP_ORIGINAL: 'keep-original' as ImageInsertMode,
      COPY_ABSOLUTE: 'copy-absolute' as ImageInsertMode,
      COPY_RELATIVE: 'copy-relative' as ImageInsertMode
    }
  }
}
