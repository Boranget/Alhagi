// ============================================================
// Alhagi Image Insert - 共享类型
// ============================================================

export type ImageInsertMode = 'keep-original' | 'copy-absolute' | 'copy-relative'

/**
 * 图片的字节源。
 * - File：来自 Web 剪贴板/拖拽/文件选择
 * - { base64 }：来自主进程原生 clipboard.readImage()（截图大文件优化路径），
 *   已编码完成不必再走渲染端 FileReader
 */
export type ImageSource = File | {
  /** 不含 `data:*;base64,` 头的纯 base64 */
  base64: string
  /** 显示用文件名（决定 alt / 子目录变量展开） */
  filename: string
  /** MIME 类型 */
  mimeType: string
}

/**
 * 插入图片的上下文：编排器收集所有副作用所需的输入，
 * 策略类通过这一个对象即可决定最终路径。
 */
export interface ImageInsertContext {
  /** 字节源；策略类用 sourceName/sourceFilename 工具读取展示信息 */
  source: ImageSource
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
 * 图片插入策略：把 source 落到磁盘并返回插入到 markdown 的路径字符串。
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

/** 从 ImageSource 取展示用文件名（用于 alt / {filename} 变量展开 / 生成图片文件名） */
export function sourceFilename(src: ImageSource): string {
  return 'base64' in src ? src.filename : src.name
}
