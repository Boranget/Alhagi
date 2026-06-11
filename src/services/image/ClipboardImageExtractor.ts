// ============================================================
// Alhagi ClipboardImageExtractor - 截图原生加速
// ============================================================
//
// Crepe upload plugin 已经从 ClipboardEvent/DragEvent 抽出 FileList 传给
// uploader。我们 uploader 内部对每个 File 调 maybeUpgradeViaMainProcess：
// 若文件较大（>1MB 启发式），用主进程 clipboard.readImage() 重新读取
// NativeImage 并编码 PNG，避免渲染端 FileReader.readAsDataURL 同步阻塞主线程
// 对几 MB 截图的影响。

import { electronService } from '@/services/electron/ElectronService'

const NATIVE_FALLBACK_BYTES = 1024 * 1024  // > 1MB 走主进程路径

export const ClipboardImageExtractor = {
  /**
   * 异步「升级」File：大文件改走主进程原生 clipboard 路径，避免渲染端阻塞。
   * 小文件原样返回。失败也回退原 file，保证调用方拿得到有效 File。
   */
  async maybeUpgradeViaMainProcess(webFile: File): Promise<File> {
    if (webFile.size < NATIVE_FALLBACK_BYTES) return webFile
    const native = await this.readViaMainProcess()
    return native ?? webFile
  },

  /** 主进程 clipboard.readImage() → 重建一个 File 对象供后续策略消费 */
  async readViaMainProcess(): Promise<File | null> {
    const api = electronService.getAPI()
    if (!api) return null
    const resp = await api.readClipboardImage()
    if (!resp.success || !resp.data) return null

    const binary = atob(resp.data.base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    return new File(
      [bytes],
      `clipboard-${Date.now()}.png`,
      { type: 'image/png' },
    )
  },
}
