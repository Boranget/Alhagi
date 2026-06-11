// ============================================================
// Alhagi NativeClipboardImage - 截图原生加速
// ============================================================
//
// Crepe upload plugin 从 ClipboardEvent/DragEvent 抽出 FileList 传给 uploader。
// 当 File.size 较大（截图 >1MB 启发式），用 Web FileReader 同步解码会阻塞渲染
// 主线程，且经 IPC 传送 13MB+ base64 字符串。
//
// 优化：主进程 clipboard.readImage() → NativeImage.toPNG() → base64 已经在主进程
// 完成，渲染端**直接拿 base64 给 persistImage 写盘**，不再 atob 还原 File 再让
// FileReader 重新编码（双重编码白白多一次）。
//
// 接口对 uploader 透明：upload plugin 一次 paste/drop 给我们一组 File，
// 我们对每个文件调 maybeUpgradeViaMainProcess，得到 ImageSource（File 或 base64
// 视情况而定），后续 persistImage(source, path) 直接消费。

import { electronService } from '@/services/electron/ElectronService'
import type { ImageSource } from './types'

const NATIVE_FALLBACK_BYTES = 1024 * 1024  // > 1MB 走主进程路径

export const NativeClipboardImage = {
  /**
   * 大文件改走主进程原生 clipboard.readImage()，避免渲染端 FileReader 同步阻塞。
   * 小文件原样返回 File。
   * 主进程读失败时回退原 File，保证调用方拿得到字节源。
   */
  async maybeUpgrade(webFile: File): Promise<ImageSource> {
    if (webFile.size < NATIVE_FALLBACK_BYTES) return webFile
    const api = electronService.getAPI()
    if (!api) return webFile
    const resp = await api.readClipboardImage()
    if (!resp.success || !resp.data) return webFile
    return {
      base64: resp.data.base64,
      filename: `clipboard-${Date.now()}.png`,
      mimeType: 'image/png',
    }
  },
}
