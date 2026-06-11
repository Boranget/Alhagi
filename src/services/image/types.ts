// ============================================================
// Alhagi Image Insert - 共享类型
// ============================================================

export type ImageInsertMode = 'keep-original' | 'copy-absolute' | 'copy-relative'

/**
 * 插入图片的上下文：编排器收集所有副作用所需的输入，
 * 策略类通过这一个对象即可决定最终路径。
 */
export interface ImageInsertContext {
  /** 二进制数据；可能来自 ClipboardEvent、拖拽、文件选择对话框，或主进程原生 clipboard 读取 */
  file: File
  /** 原始 URL（仅当 clipboard 含 text/html 且其中 <img src> 是 http(s)/file 时） */
  originalUrl?: string
  /** 当前活动 tab id；写 temp 图片时需要 */
  tabId: string
  /** 当前活动 tab 的 .md 文件路径；未保存为 undefined */
  tabFilePath?: string
  /** 工作区根目录（FileExplorer 当前打开的文件夹）；用于 absolute 模式的基准路径 */
  workspaceRoot?: string
  /** 用户偏好里的图片存储路径模板（可含 {filename}/{filedir}/... 占位符） */
  storagePathTemplate?: string
}

/**
 * 图片插入策略：把 file 落到磁盘并返回插入到 markdown 的路径字符串。
 * 三种实现：KeepOriginal / CopyAbsolute / CopyRelative。
 */
export interface ImageInsertStrategy {
  readonly mode: ImageInsertMode

  /**
   * 执行策略，返回最终要写入 markdown 的图片路径。
   * 抛错则被编排器捕获并向用户报告。
   */
  resolveFinalPath(ctx: ImageInsertContext): Promise<string>
}
