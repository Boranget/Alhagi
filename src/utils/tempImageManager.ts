import { getDirname } from '@/utils/helpers'
import { electronService } from '@/services/electron/ElectronService'

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

/**
 * 统一守卫：未在 Electron 中运行时所有临时图片功能都不可用。
 * 直接抛错而不是静默成功，让调用方有机会显示给用户。
 */
function requireApi() {
  const api = electronService.getAPI()
  if (!api) {
    throw new Error('Electron API not available')
  }
  return api
}

export async function getTempImageRootDir(): Promise<string> {
  const api = requireApi()
  const response = await api.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  return joinPaths(response.data, TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR)
}

/**
 * @deprecated 名字含 "cache" 暗示临时；图片插入策略不应再用它。
 *             用 {@link getGlobalImageStorageDir} 替代（对用户可见、命名清晰）。
 *             保留以免破坏其他可能的旧引用，新代码不要调。
 */
export async function getGlobalImageDefaultDir(): Promise<string> {
  const api = requireApi()
  const response = await api.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  return joinPaths(response.data, TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR, 'default')
}

/**
 * 用户级图片落盘的默认全局目录。
 * 与 cache（临时拷贝、清理无虞）分开，对用户在文件管理器中可发现：
 *   `<Documents>/alhagi/images/`
 *
 * copy-absolute 模式 / keep-original 兜底 用这个作为缺省 base。
 */
export async function getGlobalImageStorageDir(): Promise<string> {
  const api = requireApi()
  const response = await api.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  return joinPaths(response.data, TEMP_DIR_STRUCTURE.ALHAGI_DIR, 'images')
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
  const api = requireApi()
  const tempDir = await getTempImageDirForFile(fileId)
  const fullPath = joinPaths(tempDir, relativePath)
  const dirPath = getDirnameFromPath(fullPath)

  const ensureResult = await api.ensureDirectory(dirPath)
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || 'Failed to create directory')
  }
  return dirPath
}

export async function saveTempImage(fileId: string, relativePath: string, base64Content: string): Promise<string> {
  const api = requireApi()
  const tempDir = await getTempImageDirForFile(fileId)
  const filePath = joinPaths(tempDir, relativePath)

  const ensureResult = await api.ensureDirectory(getDirnameFromPath(filePath))
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || 'Failed to create directory')
  }

  const result = await api.saveBinaryFile(filePath, base64Content)
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to save temp image')
  }

  return filePath
}

export async function copyTempImagesToTarget(fileId: string, targetDir: string): Promise<{ tempPath: string; targetPath: string }[]> {
  requireApi() // 守卫；后续函数会再次取 api
  const tempDir = await getTempImageDirForFile(fileId)
  const copiedFiles: { tempPath: string; targetPath: string }[] = []
  await copyDirectoryRecursive(tempDir, targetDir, copiedFiles)
  return copiedFiles
}

async function copyDirectoryRecursive(srcDir: string, destDir: string, copiedFiles: { tempPath: string; targetPath: string }[]): Promise<void> {
  const api = requireApi()
  const result = await api.readDirectory(srcDir)
  if (!result.success || !result.data) return

  const ensureResult = await api.ensureDirectory(destDir)
  if (!ensureResult.success) return

  for (const entry of result.data) {
    const srcPath = joinPaths(srcDir, entry.name)
    const destPath = joinPaths(destDir, entry.name)

    if (entry.isDirectory) {
      await copyDirectoryRecursive(srcPath, destPath, copiedFiles)
    } else {
      const copyResult = await api.copyFile(srcPath, destPath)
      if (copyResult.success) {
        copiedFiles.push({ tempPath: srcPath, targetPath: destPath })
      }
    }
  }
}

/**
 * 删除某 tab 的全部临时图片目录。
 *
 * 主进程的 FILE.DELETE handler 同时支持文件和目录（递归删除），所以这里复用 deleteFile()。
 * 不存在 `deleteDirectory` 方法。
 */
export async function deleteTempImageDir(fileId: string): Promise<void> {
  const api = requireApi()
  const tempDir = await getTempImageDirForFile(fileId)
  await api.deleteFile(tempDir)
}

export async function listTempImages(fileId: string): Promise<string[]> {
  requireApi()
  const tempDir = await getTempImageDirForFile(fileId)
  const images: string[] = []
  await collectImages(tempDir, images)
  return images
}

async function collectImages(dir: string, images: string[]): Promise<void> {
  const api = requireApi()
  const result = await api.readDirectory(dir)
  if (!result.success || !result.data) return

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
