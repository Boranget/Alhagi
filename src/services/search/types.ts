import type { SearchConfig } from '@/utils/search'

export interface SearchResult {
  current: number
  total: number
}

export interface ReplaceResult {
  replaced: number
}

export interface SearchService {
  search(config: SearchConfig, options?: { select?: boolean }): SearchResult
  clear(): void
  findNext(): SearchResult
  findPrev(): SearchResult
  replaceNext(replacement: string): SearchResult
  replaceAll(replacement: string): ReplaceResult
  readonly isReplacing: boolean
  /**
   * 文档变化时本服务是否已自行重算并写入 searchStore 共享计数。
   * true（Crepe 插件 apply Path 2）时，门面在 CONTENT_CHANGED/替换后刷新
   * 跳过重跑 search()，避免同一次编辑触发多轮全量匹配；CM 路径不写共享
   * 态，需保留门面重查（false/省略）。
   */
  readonly selfWritesStoreOnDocChange?: boolean
}
