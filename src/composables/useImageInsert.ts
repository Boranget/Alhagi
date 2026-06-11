// ============================================================
// useImageInsert - 薄壳，转发给 ImageInsertOrchestrator
// ============================================================
//
// 历史上这里塞了三种模式（keep-original/copy-absolute/copy-relative）的实现细节，
// 现已拆到 src/services/image/strategies/ 各策略类。本文件仅保留组件友好的 API。

import { useImageInsertOrchestrator } from '@/services/image/ImageInsertOrchestrator'
import type { ImageInsertMode } from '@/services/image/types'
import { resolvePathVariables } from '@/services/image/ImagePathResolver'
import { FILE } from '@/constants'
import { usePreferencesStore } from '@/stores/preferences'

export type { ImageInsertMode }

export const PATH_VARIABLES = {
  FILENAME: '{filename}',
  FILE_DIR: '{filedir}',
  DATE: '{date}',
  TIME: '{time}',
  DATETIME: '{datetime}',
} as const

export function useImageInsert() {
  const orchestrator = useImageInsertOrchestrator()
  const prefsStore = usePreferencesStore()

  /** 插入二进制图片（剪贴板/拖拽/文件选择共享路径） */
  async function insertImage(file: File, originalPath?: string): Promise<string | null> {
    return orchestrator.insertFromFile(file, originalPath)
  }

  /** 直接插入磁盘已有路径，不写文件 */
  function insertImageByPath(imagePath: string, altText?: string): void {
    orchestrator.insertByPath(imagePath, altText)
  }

  /** 弹出文件选择对话框；可选切换插入模式 */
  async function selectAndInsertImage(mode?: ImageInsertMode): Promise<void> {
    if (mode) prefsStore.setPreference('imageInsertMode', mode)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = FILE.IMAGE_EXTENSIONS.join(',')
    input.multiple = false
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) await orchestrator.insertFromFile(file)
    }
    input.click()
  }

  function setInsertMode(mode: ImageInsertMode) {
    prefsStore.setPreference('imageInsertMode', mode)
  }

  return {
    insertImage,
    insertImageByPath,
    selectAndInsertImage,
    setInsertMode,
    resolvePathVariables,
  }
}
