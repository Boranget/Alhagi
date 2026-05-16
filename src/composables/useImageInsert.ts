import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'

export type ImageInsertMode = 'keep-original' | 'copy-absolute' | 'copy-relative'

export interface ImageInsertOptions {
  mode: ImageInsertMode
  customPath?: string
  useVariables?: boolean
}

function generateImageName(file: File): string {
  return `${Date.now()}_${file.name}`
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
        imagePath = file.name
      } else if (lastInsertMode.value === 'copy-absolute') {
        imagePath = await copyImageToDirectory(file, '')
      } else {
        imagePath = await copyImageRelative(file, activeTab.filePath || '')
      }
      
      markdown = `![${file.name}](${imagePath})`
      
      insertMarkdownAtCursor(markdown)
      
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
    const targetDir = directory || '/tmp/alhagi-images'
    const newName = generateImageName(file)
    return `${targetDir}/${newName}`
  }
  
  async function copyImageRelative(file: File, mdFilePath: string): Promise<string> {
    const newName = generateImageName(file)
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
