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
 * 把字节流写入 absolutePath（保证父目录存在）。
 *
 * 接受 File 或已编码的 base64 字符串：
 *   - File 路径需经 FileReader 同步阻塞编码（小文件可接受）
 *   - base64 路径直接 IPC saveBinary（截图大文件优化：主进程 NativeImage→PNG
 *     已经产出 base64，这里直接走，避免渲染端重新 FileReader 编码再去前缀）
 */
export async function persistImage(
  source: File | { base64: string },
  absolutePath: string,
): Promise<void> {
  const api = electronService.getAPI()
  if (!api) throw new Error('Electron API not available')

  const dirPath = absolutePath.replace(/[\\/][^\\/]+$/, '')
  const ensureResult = await api.ensureDirectory(dirPath)
  if (!ensureResult.success) {
    throw new Error(ensureResult.error?.message || `ensureDirectory failed: ${dirPath}`)
  }

  const base64 = 'base64' in source ? source.base64 : await fileToBase64(source)
  const saveResult = await api.saveBinaryFile(absolutePath, base64)
  if (!saveResult.success) {
    throw new Error(saveResult.error?.message || `saveBinaryFile failed: ${absolutePath}`)
  }
}
