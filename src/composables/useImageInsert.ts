import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { FILE } from '@/constants'
import { getDirname, getRelativePath } from '@/utils/helpers'

export type ImageInsertMode = 'keep-original' | 'copy-absolute' | 'copy-relative'

export const PATH_VARIABLES = {
  FILENAME: '{filename}',
  FILE_DIR: '{filedir}',
  DATE: '{date}',
  TIME: '{time}',
  DATETIME: '{datetime}'
} as const

export type PathVariable = typeof PATH_VARIABLES[keyof typeof PATH_VARIABLES]

function resolvePathVariables(template: string, context: {
  fileName?: string
  filePath?: string
}): string {
  const { fileName = 'image', filePath = '' } = context
  const fileDir = filePath.split('/').slice(0, -1).join('/')
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-')
  const datetime = `${date}-${time}`
  
  return template
    .replace(/\{filename\}/gi, fileName)
    .replace(/\{filedir\}/gi, fileDir)
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{datetime\}/gi, datetime)
}

function generateImageName(file: File): string {
  const extension = file.name.split('.').pop() || ''
  const nameWithoutExt = file.name.replace(/\.[^.]+$/, '')
  return `${Date.now()}_${nameWithoutExt}.${extension}`
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const dataUrl = reader.result as string
        const base64Match = dataUrl?.match(/^data:.*?;base64,(.*)$/)
        
        if (!base64Match) {
          console.error('[ImageInsert] Invalid data URL format')
          reject(new Error('Invalid data URL format'))
          return
        }
        
        const base64 = base64Match[1]
        resolve(base64)
      } catch (err) {
        console.error('[ImageInsert] Base64 conversion error:', err)
        reject(err)
      }
    }
    reader.onerror = (err) => {
      console.error('[ImageInsert] FileReader error:', err)
      reject(err)
    }
    reader.readAsDataURL(file)
  })
}

export function useImageInsert() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const editorManager = useCrepeEditorManager()
  
  const isInserting = ref(false)
  
  async function insertImage(file: File): Promise<string | null> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      console.error('[ImageInsert] No active tab found')
      return null
    }
    
    isInserting.value = true
    
    try {
      const mode = prefsStore.imageInsertMode
      let imagePath: string
      
      if (mode === 'keep-original') {
        // keep-original：只写文件名，不复制文件
        imagePath = file.name
      } else {
        // copy-absolute / copy-relative：复制文件到目标目录，路径格式由 mode 决定
        imagePath = await copyImageToDirectory(file, mode)
      }
      
      const altText = file.name.replace(/\.[^.]+$/, '')
      // 原样写入 MD，不做 file:// 转换（渲染时由插件统一处理）
      await editorManager.insertImage(imagePath, altText)
      
      tabsStore.updateTab(activeTab.id, {
        isDirty: true,
        lastModified: Date.now()
      })
      
      return imagePath
    } catch (error) {
      console.error('[ImageInsert] Failed to insert image:', error)
      return null
    } finally {
      isInserting.value = false
    }
  }
  
  /**
   * 复制图片到目标目录
   *
   * 核心原则：
   * - 文件总是保存到绝对路径（确保写入成功）
   * - 返回的路径格式由 mode 决定：
   *   copy-absolute → 返回绝对路径（如 D:/project/assets/img.png）
   *   copy-relative → 返回相对于 MD 文件的路径（如 ./assets/img.png）
   */
  async function copyImageToDirectory(file: File, mode: ImageInsertMode): Promise<string> {
    const activeTab = tabsStore.activeTab
    const mdFilePath = activeTab?.filePath || ''
    const mdDir = mdFilePath ? getDirname(mdFilePath) : ''
    
    // 确定目标目录模板
    let targetDirTemplate = prefsStore.imageStoragePath
    if (!targetDirTemplate) {
      targetDirTemplate = mdDir 
        ? `${mdDir}/${FILE.DEFAULT_IMAGE_FOLDER}`
        : `./${FILE.DEFAULT_IMAGE_FOLDER}`
    }
    
    // 解析为绝对路径（用于实际保存文件）
    let absoluteTargetDir = targetDirTemplate
    if (!absoluteTargetDir.match(/^[A-Za-z]:[\\/]/) && !absoluteTargetDir.startsWith('/')) {
      // 相对路径 → 以 MD 文件目录为基准解析
      absoluteTargetDir = mdDir
        ? `${mdDir}/${absoluteTargetDir}`.replace(/\/+/g, '/')
        : absoluteTargetDir
    }
    
    const fileNameWithoutExt = file.name.replace(/\.[^.]+$/, '')
    const fileExt = file.name.match(/\.[^.]+$/)?.[0] || ''
    
    let resolvedPath = resolvePathVariables(absoluteTargetDir, {
      fileName: fileNameWithoutExt,
      filePath: mdFilePath
    })
    
    if (!resolvedPath.endsWith('/')) {
      resolvedPath += '/'
    }
    
    const fileName = generateImageName(file)
    const absolutePath = `${resolvedPath}${fileName}`
    
    // 保存文件到磁盘（使用绝对路径）
    const base64Content = await fileToBase64(file)
    const saveResult = await (window as any).electronAPI.saveBinaryFile(absolutePath, base64Content)
    
    if (!saveResult.success) {
      throw new Error(saveResult.error?.message || 'Failed to save image')
    }
    
    // 根据模式返回不同格式的路径（写入 MD 的内容）
    if (mode === 'copy-relative' && mdDir) {
      // 计算 MD 文件到图片的相对路径
      return getRelativePath(mdDir, absolutePath)
    }
    
    // copy-absolute：返回绝对路径
    return absolutePath
  }
  
  async function insertImageByPath(imagePath: string, altText?: string): Promise<void> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return
    
    const alt = altText || imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'image'
    // 原样写入，不做路径转换
    await editorManager.insertImage(imagePath, alt)
    
    tabsStore.updateTab(activeTab.id, {
      isDirty: true,
      lastModified: Date.now()
    })
  }
  
  async function selectAndInsertImage(mode?: ImageInsertMode): Promise<void> {
    if (mode) {
      prefsStore.setPreference('imageInsertMode', mode)
    }
    
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = FILE.IMAGE_EXTENSIONS.join(',')
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        await insertImage(file)
      }
    }
    
    input.click()
  }
  
  function setInsertMode(mode: ImageInsertMode) {
    prefsStore.setPreference('imageInsertMode', mode)
  }
  
  return {
    isInserting,
    insertImage,
    insertImageByPath,
    selectAndInsertImage,
    setInsertMode,
    resolvePathVariables
  }
}
