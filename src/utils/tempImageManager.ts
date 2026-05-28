import { FILE } from '@/constants'
import { getDirname } from '@/utils/helpers'

const TEMP_DIR_STRUCTURE = {
  ALHAGI_DIR: 'alhagi',
  CACHE_DIR: 'cache',
  IMAGE_DIR: 'image'
}

function joinPaths(...paths: string[]): string {
  return paths
    .filter(Boolean)
    .map(p => p.replace(/[\\/]+$/, '').replace(/^[\\/]+/, ''))
    .join('/')
    .replace(/\/+/g, '/')
}

function getDirnameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash > 0 ? normalized.substring(0, lastSlash) : ''
}

export async function getTempImageRootDir(): Promise<string> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const response = await window.electronAPI.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  const docDir = response.data
  
  return joinPaths(docDir, TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR)
}

export async function getGlobalImageDefaultDir(): Promise<string> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const response = await window.electronAPI.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  const docDir = response.data
  
  return joinPaths(docDir, TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR, 'default')
}

export async function getTempImageDirForFile(fileId: string): Promise<string> {
  const rootDir = await getTempImageRootDir()
  return joinPaths(rootDir, fileId)
}

export async function getTempImagePath(fileId: string, relativePath: string): Promise<string> {
  const tempDir = await getTempImageDirForFile(fileId)
  return joinPaths(tempDir, relativePath)
}

export async function ensureTempImageDirForPath(fileId: string, relativePath: string): Promise<string> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const tempDir = await getTempImageDirForFile(fileId)
  const fullPath = joinPaths(tempDir, relativePath)
  const dirPath = getDirnameFromPath(fullPath)
  
  const ensureResult = await window.electronAPI.ensureDirectory(dirPath)
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || 'Failed to create directory')
  }
  return dirPath
}

export async function saveTempImage(fileId: string, relativePath: string, base64Content: string): Promise<string> {
  const tempDir = await getTempImageDirForFile(fileId)
  const filePath = joinPaths(tempDir, relativePath)
  
  const ensureResult = await window.electronAPI.ensureDirectory(getDirnameFromPath(filePath))
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || 'Failed to create directory')
  }
  
  const result = await window.electronAPI.saveBinaryFile(filePath, base64Content)
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to save temp image')
  }
  
  return filePath
}

export async function copyTempImagesToTarget(fileId: string, targetDir: string): Promise<{ tempPath: string; targetPath: string }[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const tempDir = await getTempImageDirForFile(fileId)
  const result = await window.electronAPI.readDirectory(tempDir)
  
  if (!result.success || !result.data) {
    return []
  }
  
  const copiedFiles: { tempPath: string; targetPath: string }[] = []
  
  await copyDirectoryRecursive(tempDir, targetDir, copiedFiles)
  
  return copiedFiles
}

async function copyDirectoryRecursive(srcDir: string, destDir: string, copiedFiles: { tempPath: string; targetPath: string }[]): Promise<void> {
  const result = await window.electronAPI.readDirectory(srcDir)
  
  if (!result.success || !result.data) {
    return
  }
  
  const ensureResult = await window.electronAPI.ensureDirectory(destDir)
  if (!ensureResult.success) {
    return
  }
  
  for (const entry of result.data) {
      const srcPath = joinPaths(srcDir, entry.name)
      const destPath = joinPaths(destDir, entry.name)
    
    if (entry.isDirectory) {
      await copyDirectoryRecursive(srcPath, destPath, copiedFiles)
    } else {
      const copyResult = await window.electronAPI.copyFile(srcPath, destPath)
      
      if (copyResult.success) {
        copiedFiles.push({
          tempPath: srcPath,
          targetPath: destPath
        })
      }
    }
  }
}

export async function deleteTempImageDir(fileId: string): Promise<void> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const tempDir = await getTempImageDirForFile(fileId)
  await window.electronAPI.deleteDirectory(tempDir)
}

export async function listTempImages(fileId: string): Promise<string[]> {
  if (!window.electronAPI) {
    throw new Error('Electron API not available')
  }
  
  const tempDir = await getTempImageDirForFile(fileId)
  const result = await window.electronAPI.readDirectory(tempDir)
  
  if (!result.success || !result.data) {
    return []
  }
  
  const images: string[] = []
  await collectImages(tempDir, images)
  
  return images
}

async function collectImages(dir: string, images: string[]): Promise<void> {
  const result = await window.electronAPI.readDirectory(dir)
  
  if (!result.success || !result.data) {
    return
  }
  
  for (const entry of result.data) {
      const fullPath = joinPaths(dir, entry.name)
    
    if (entry.isDirectory) {
      await collectImages(fullPath, images)
    } else {
      images.push(fullPath)
    }
  }
}

export function getTempImageUrl(filePath: string): string {
  return `file:///${filePath.replace(/\\/g, '/')}`
}

export function isTempImagePath(path: string): boolean {
  return path.includes(joinPaths(TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR))
}

export async function resolveImagePath(imagePath: string, fileId: string, mdFilePath?: string): Promise<string> {
  if (mdFilePath) {
    const mdDir = getDirname(mdFilePath)
    const resolved = joinPaths(mdDir, imagePath)
    return `file:///${resolved.replace(/\\/g, '/')}`
  }
  
  const tempPath = await getTempImagePath(fileId, imagePath)
  return `file:///${tempPath.replace(/\\/g, '/')}`
}

export async function getDefaultImageRelativePath(): Promise<string> {
  return `${FILE.DEFAULT_IMAGE_FOLDER}/`
}

export async function getImageTargetDir(mdFilePath?: string, workspaceRoot?: string): Promise<string> {
  if (mdFilePath) {
    return getDirname(mdFilePath)
  }
  return workspaceRoot || ''
}