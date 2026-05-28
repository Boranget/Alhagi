import { ref } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { FILE } from '@/constants'
import { getDirname, getRelativePath } from '@/utils/helpers'
import { saveTempImage, getGlobalImageDefaultDir } from '@/utils/tempImageManager'

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
          reject(new Error('Invalid data URL format'))
          return
        }
        
        const base64 = base64Match[1]
        resolve(base64)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = (err) => {
      reject(err)
    }
    reader.readAsDataURL(file)
  })
}

export function useImageInsert() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const fileExplorerStore = useFileExplorerStore()
  const editorManager = useCrepeEditorManager()
  
  const isInserting = ref(false)
  
  async function insertImage(file: File, originalPath?: string): Promise<string | null> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      console.log('[insertImage] 没有活跃的标签页')
      return null
    }
    
    if (originalPath) {
      const currentContent = editorManager.getMarkdown()
      if (currentContent.includes(originalPath)) {
        console.log('[insertImage] 检测到编辑器已包含该图片URL，跳过插入')
        console.log('[insertImage] 原始路径:', originalPath)
        return null
      }
    }
    
    isInserting.value = true
    
    try {
      const mode = prefsStore.imageInsertMode
      console.log('[insertImage] 当前图片插入模式:', mode)
      console.log('[insertImage] 原始路径:', originalPath || '(无)')
      console.log('[insertImage] 文件名:', file.name)
      console.log('[insertImage] 标签页ID:', activeTab.id)
      console.log('[insertImage] 文件路径:', activeTab.filePath || '(未保存)')
      
      let imagePath: string
      
      if (mode === 'keep-original') {
        console.log('[insertImage] 使用保留原始路径模式')
        imagePath = await handleKeepOriginalMode(file, originalPath)
      } else if (mode === 'copy-absolute') {
        console.log('[insertImage] 使用复制到全局目录模式')
        imagePath = await handleCopyAbsoluteMode(file)
      } else {
        console.log('[insertImage] 使用复制到相对目录模式')
        imagePath = await handleCopyRelativeMode(file, activeTab.id, activeTab.filePath)
      }
      
      console.log('[insertImage] 生成的图片路径:', imagePath)
      
      const altText = file.name.replace(/\.[^.]+$/, '')
      console.log('[insertImage] 插入图片到编辑器，alt文本:', altText)
      await editorManager.insertImage(imagePath, altText)
      
      tabsStore.updateTab(activeTab.id, {
        isDirty: true,
        lastModified: Date.now()
      })
      
      return imagePath
    } catch (error) {
      console.error('[insertImage] 发生错误:', error)
      return null
    } finally {
      isInserting.value = false
    }
  }
  
  async function handleKeepOriginalMode(file: File, originalPath?: string): Promise<string> {
    if (originalPath) {
      return originalPath
    }
    return file.name
  }
  
  async function handleCopyAbsoluteMode(file: File): Promise<string> {
    console.log('[handleCopyAbsoluteMode] === 开始处理 ===')
    console.log('[handleCopyAbsoluteMode] 文件名:', file.name)
    console.log('[handleCopyAbsoluteMode] 文件大小:', file.size, 'bytes')
    
    const fileName = generateImageName(file)
    console.log('[handleCopyAbsoluteMode] 生成的文件名:', fileName)
    
    let targetDir: string
    const userSetting = prefsStore.imageStoragePath
    console.log('[handleCopyAbsoluteMode] 用户设置:', userSetting || '(空，使用默认值)')
    
    const workspaceRoot = fileExplorerStore.currentFolder
    console.log('[handleCopyAbsoluteMode] 工作区目录:', workspaceRoot || '(空)')
    
    if (userSetting) {
      const baseDir = workspaceRoot || (await getGlobalImageDefaultDir())
      console.log('[handleCopyAbsoluteMode] 基础目录:', baseDir)
      
      if (userSetting.match(/^[A-Za-z]:[\\/]/) || userSetting.startsWith('/')) {
        targetDir = userSetting
        console.log('[handleCopyAbsoluteMode] 使用绝对路径作为目标目录')
      } else {
        targetDir = `${baseDir}/${userSetting}`
        console.log('[handleCopyAbsoluteMode] 使用相对路径，组合为:', targetDir)
      }
    } else {
      console.log('[handleCopyAbsoluteMode] 用户未设置，使用默认全局目录')
      targetDir = await getGlobalImageDefaultDir()
      console.log('[handleCopyAbsoluteMode] 默认全局目录:', targetDir)
    }
    
    const resolvedDir = resolvePathVariables(targetDir, {
      fileName: file.name.replace(/\.[^.]+$/, '')
    })
    console.log('[handleCopyAbsoluteMode] 解析后的目录:', resolvedDir)
    
    const ensureResult = await window.electronAPI.ensureDirectory(resolvedDir)
    if (!ensureResult.success) {
      throw new Error(ensureResult.error?.message || 'Failed to create directory')
    }
    console.log('[handleCopyAbsoluteMode] 目录已确保存在')
    
    const absolutePath = `${resolvedDir}/${fileName}`
    console.log('[handleCopyAbsoluteMode] 完整路径:', absolutePath)
    
    const base64Content = await fileToBase64(file)
    console.log('[handleCopyAbsoluteMode] 文件转为 base64，长度:', base64Content.length)
    
    const saveResult = await window.electronAPI.saveBinaryFile(absolutePath, base64Content)
    console.log('[handleCopyAbsoluteMode] 保存结果:', saveResult)
    
    if (!saveResult.success) {
      console.error('[handleCopyAbsoluteMode] 保存失败:', saveResult.error)
      throw new Error(saveResult.error?.message || 'Failed to save image')
    }
    
    console.log('[handleCopyAbsoluteMode] === 处理完成 ===')
    return absolutePath
  }
  
  async function handleCopyRelativeMode(file: File, fileId: string, mdFilePath?: string): Promise<string> {
    const fileName = generateImageName(file)
    const relativePath = `${FILE.DEFAULT_IMAGE_FOLDER}/${fileName}`
    
    if (mdFilePath) {
      const mdDir = getDirname(mdFilePath)
      
      let targetDir: string
      const userSetting = prefsStore.imageStoragePath
      
      if (userSetting) {
        if (userSetting.match(/^[A-Za-z]:[\\/]/) || userSetting.startsWith('/')) {
          targetDir = userSetting
        } else {
          targetDir = `${mdDir}/${userSetting}`
        }
      } else {
        targetDir = `${mdDir}/${FILE.DEFAULT_IMAGE_FOLDER}`
      }
      
      const resolvedDir = resolvePathVariables(targetDir, {
        fileName: file.name.replace(/\.[^.]+$/, ''),
        filePath: mdFilePath
      })
      
      await window.electronAPI.ensureDirectory(resolvedDir)
      const absolutePath = `${resolvedDir}/${fileName}`
      const base64Content = await fileToBase64(file)
      const saveResult = await window.electronAPI.saveBinaryFile(absolutePath, base64Content)
      
      if (!saveResult.success) {
        throw new Error(saveResult.error?.message || 'Failed to save image')
      }
      
      return getRelativePath(mdDir, absolutePath)
    } else {
      const base64Content = await fileToBase64(file)
      await saveTempImage(fileId, relativePath, base64Content)
      return relativePath
    }
  }
  
  async function insertImageByPath(imagePath: string, altText?: string): Promise<void> {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return
    
    const alt = altText || imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'image'
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