// ============================================================
// DocumentSync — tab 文档内容的单一权威同步
// ============================================================
//
// tabsStore 中每个 tab 的 content 是唯一真相源（single source of truth）。
// 编辑器不直接互相通信，只与权威交互：
//
//   编辑器输入 → commit() 写权威 → watch 响应式刷新所有视图
//
// 视图刷新由 apply 侧负责比对（内容相同不动编辑器，保护光标/undo）
// 与断环（Crepe 侧 doc 引用 echo 抑制、CM 侧 ExternalChange 注解）。
// 不变量「所有视图内容 == 权威内容」由该结构保证，
// 而非分散在各处的 viewMode 条件判断。
//
// 由此，任何直写 store 的路径（搜索替换、外部重载等）都会
// 自动刷新编辑器，无需各自记得通知。
//
// 注意「刷新」是派发真实编辑器事务（PM tr.replace / CM dispatch），
// 因此**直写 store 的内容变更会进入两侧编辑器的原生 undo 历史**——
// 替换等操作天然可撤销，无需另行实现历史栈（也不存在 store 级历史，
// 历史只属于编辑器）。副作用：对侧收到的同步推送同样占一条 undo 记录，
// 跨模式撤销按提交顺序逐步回退。

import { watch, type WatchStopHandle } from 'vue'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'

export interface DocumentSyncTargets {
  /** 当前可见编辑器的最新 markdown（用于 flush；不可用或组合期返回 null——暂态不进权威） */
  readVisible: () => string | null
  /** 把权威内容应用到 wysiwyg 侧（内部负责比对与断环） */
  applyToWysiwyg: (content: string) => void
  /** 把权威内容应用到 source 侧（内部负责比对与断环） */
  applyToSource: (content: string) => void
  /** 权威内容发生实际变更后的统一通知（搜索高亮等） */
  onAuthoritativeChange?: (content: string) => void
}

export interface DocumentSync {
  /** 编辑器 → 权威的唯一写入口。返回是否真的发生变更 */
  commit(content: string, options?: { markDirty?: boolean }): boolean
  /** 把可见编辑器中尚未 commit 的内容（Crepe 防抖窗口）冲刷进权威 */
  flush(): void
  stop(): void
}

export function startDocumentSync(
  tabId: string,
  tabRepository: ITabRepository,
  targets: DocumentSyncTargets
): DocumentSync {
  let stopped = false

  const commit = (content: string, options: { markDirty?: boolean } = {}): boolean => {
    if (stopped) return false

    const current = tabRepository.getById(tabId)
    if (current && current.content === content) return false

    tabRepository.update(tabId, {
      content,
      ...(options.markDirty === false ? {} : { isDirty: true }),
      lastModified: Date.now(),
    })
    return true
  }

  // 权威 → 视图：store 变更时刷新两侧编辑器。
  // 直写 store 的路径（搜索替换等）也由此自动接入。
  const stopHandle: WatchStopHandle = watch(
    () => tabRepository.getById(tabId)?.content ?? null,
    (content) => {
      if (content == null || stopped) return
      targets.applyToWysiwyg(content)
      targets.applyToSource(content)
      targets.onAuthoritativeChange?.(content)
    },
    { flush: 'pre' }
  )

  const flush = (): void => {
    const visible = targets.readVisible()
    if (visible != null) commit(visible)
  }

  return {
    commit,
    flush,
    stop: () => {
      stopped = true
      stopHandle()
    },
  }
}
