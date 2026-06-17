// ============================================================
// FileType Descriptor & Registry
// ============================================================
//
// alhagi 的文件类型识别 / 加载策略 / 渲染组件 / 保存策略，统一收敛在这里。
// 添加一种新文件类型（PDF / 视频 / Hex / SVG 编辑器 / ...）只需：
//   1. 写一个 viewer 组件（Vue SFC）
//   2. 在 descriptors/ 下加一个 descriptor 模块
//   3. 在 index.ts 里 import 一次
// 完。无需改 EditorContainer / FileExplorer / tabService / detectFileType。
//
// 见 [[alhagi-auxiliary-features]]：alhagi 是 Markdown 编辑器，
// 其它类型属于辅助功能，与主链路通过 descriptor 解耦。

import type { Component } from 'vue'

/**
 * 加载策略：决定打开文件时怎么读、tab.content 怎么填。
 *
 *   utf8     —— 读 UTF-8 文本塞 tab.content（markdown / 纯文本）
 *   none     —— 不读，tab.content 留空（图片自管 readBinaryFile / 不支持文件仅展示提示）
 *
 * 未来可能扩展：'binary'（让 viewer 拿 base64 / Uint8Array）等。
 */
export type LoadStrategy = 'utf8' | 'none'

export interface FileTypeDescriptor {
  /** 唯一标识，用作 tab.fileType 字段值。 */
  id: string

  /** 显示名（i18n key 或纯字符串），UI 提示用。 */
  displayName: string

  /**
   * 关联扩展名清单。元素必须以 '.' 开头小写（如 '.md'）。
   * 也支持 '.gitignore' 这种以 '.' 开头的"全名扩展"。
   * 'unsupported' descriptor 留空数组。
   */
  extensions: readonly string[]

  /** 打开文件时的内容加载策略。 */
  loadStrategy: LoadStrategy

  /**
   * 是否参与编辑/保存路径：
   *   true  → 关闭 tab 前若 isDirty 弹确认；Ctrl+S 走 tabService.saveFile
   *   false → 只读（image / unsupported），关闭无确认
   */
  canSave: boolean

  /**
   * "另存为" 对话框的默认扩展名（含点）。仅在 canSave=true 时使用。
   * 例如 markdown → '.md'，text → ''（不强加）。
   */
  defaultExtension: string

  /**
   * 渲染组件：在 EditorContainer 里以覆盖层方式 mount。
   *
   * 约定接口（可选 props）：
   *   :file-path?: string | null
   *   :model-value?: string                               (canSave=true 才有意义)
   *   @update:model-value?: (content: string) => void     (canSave=true 才有意义)
   *
   * 没有 viewer 时（id === 'editor' / 'unsupported'）值为 null：
   *   - 'editor' 走主编辑器外壳（Crepe + CodeMirror），不走覆盖层
   *   - 'unsupported' 走内置的"不支持"提示，也不走覆盖层
   */
  viewer: Component | null
}

const registry = new Map<string, FileTypeDescriptor>()
const extToId = new Map<string, string>()
let fallbackId: string | null = null

/**
 * 注册一个 descriptor。重复 id / 扩展名冲突会抛错（开发期立即可见）。
 * `isFallback=true` 标记这个 descriptor 是兜底（无任何扩展名匹配时返回它）。
 */
export function registerFileType(d: FileTypeDescriptor, isFallback = false): void {
  if (registry.has(d.id)) {
    throw new Error(`[fileTypes] duplicate descriptor id: ${d.id}`)
  }
  for (const ext of d.extensions) {
    if (!ext.startsWith('.')) {
      throw new Error(`[fileTypes] extension must start with '.': ${d.id} → ${ext}`)
    }
    const lower = ext.toLowerCase()
    const owner = extToId.get(lower)
    if (owner && owner !== d.id) {
      throw new Error(`[fileTypes] extension '${lower}' already owned by '${owner}', cannot give to '${d.id}'`)
    }
    extToId.set(lower, d.id)
  }
  registry.set(d.id, d)
  if (isFallback) {
    if (fallbackId && fallbackId !== d.id) {
      throw new Error(`[fileTypes] only one fallback allowed, '${fallbackId}' already set`)
    }
    fallbackId = d.id
  }
}

export function getDescriptor(id: string): FileTypeDescriptor | undefined {
  return registry.get(id)
}

export function listDescriptors(): FileTypeDescriptor[] {
  return Array.from(registry.values())
}

/**
 * 文件路径 → descriptor。识别失败返回兜底（unsupported）。
 *
 * 扩展名解析支持：
 *   - 普通扩展名：foo.md / bar.PNG（大小写不敏感）
 *   - 全名扩展：.gitignore / .editorconfig（以 '.' 开头的整个文件名）
 *   - 无扩展名：Dockerfile / Makefile → 兜底
 */
export function detectDescriptor(filePath: string | null): FileTypeDescriptor {
  // 欢迎页 / 新建空白：当作 markdown 编辑器，让 Crepe 挂载占位
  if (!filePath) {
    return registry.get('editor') ?? requireFallback()
  }

  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? ''
  const dotIdx = fileName.lastIndexOf('.')
  const ext = dotIdx === -1
    ? ''                          // Dockerfile / Makefile
    : dotIdx === 0
      ? fileName                  // .gitignore
      : fileName.slice(dotIdx)    // .md / .png

  if (ext) {
    const id = extToId.get(ext)
    if (id) {
      const d = registry.get(id)
      if (d) return d
    }
  }
  return requireFallback()
}

function requireFallback(): FileTypeDescriptor {
  if (!fallbackId) {
    throw new Error('[fileTypes] no fallback descriptor registered')
  }
  const d = registry.get(fallbackId)
  if (!d) throw new Error(`[fileTypes] fallback descriptor '${fallbackId}' missing`)
  return d
}

/** 全部已注册 id 集合（schema 校验 / 运行时健康检查用）。 */
export function getRegisteredIds(): string[] {
  return Array.from(registry.keys())
}
