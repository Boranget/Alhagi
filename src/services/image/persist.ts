// ============================================================
// Alhagi Image Insert - 共享 IO helper
// ============================================================
//
// 三种策略中重复出现的"读 base64 + ensureDir + saveBinary"模板。
// 抽出来避免每个 strategy 各写一遍。

import { electronService } from '@/services/electron/ElectronService'

/** File → base64 字符串（仅含 base64 部分，不含 `data:*;base64,` 头） */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const match = dataUrl?.match(/^data:.*?;base64,(.*)$/)
      if (!match) return reject(new Error('Invalid data URL format'))
      resolve(match[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * 把 file 写入 absolutePath（保证父目录存在）。
 * 抛错时调用方负责报告给用户。
 */
export async function persistImage(file: File, absolutePath: string): Promise<void> {
  const api = electronService.getAPI()
  if (!api) throw new Error('Electron API not available')

  const dirPath = absolutePath.replace(/[\\/][^\\/]+$/, '')
  const ensureResult = await api.ensureDirectory(dirPath)
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || `ensureDirectory failed: ${dirPath}`)
  }

  const base64 = await fileToBase64(file)
  const saveResult = await api.saveBinaryFile(absolutePath, base64)
  if (!saveResult.success) {
    throw new Error(saveResult.error?.message || `saveBinaryFile failed: ${absolutePath}`)
  }
}
