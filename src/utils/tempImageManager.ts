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

async function getTempImageRootDir(): Promise<string> {
  const api = requireApi()
  const response = await api.getDocumentsDirectory()
  if (!response.success || !response.data) {
    throw new Error('Cannot get documents directory')
  }
  return joinPaths(response.data, TEMP_DIR_STRUCTURE.ALHAGI_DIR, TEMP_DIR_STRUCTURE.CACHE_DIR, TEMP_DIR_STRUCTURE.IMAGE_DIR)
}

async function getTempImageDirForFile(fileId: string): Promise<string> {
  const rootDir = await getTempImageRootDir()
  return joinPaths(rootDir, fileId)
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
