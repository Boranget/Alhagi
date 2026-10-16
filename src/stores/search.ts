import { defineStore } from 'pinia'
import { ref } from 'vue'

interface SearchQuery {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

/**
 * 应用级搜索状态：编辑器搜索引擎（CrepeSearchService 等）与搜索 UI 之间的
 * 唯一共享通道。仅引擎读写——组件一律经 useWorkspaceSearch 门面访问；
 * 早年的 action 委托层（search/clear/findNext/...）生产零调用，已删除。
 */
export const useSearchStore = defineStore('search', () => {
  const currentQuery = ref<SearchQuery | null>(null)
  const currentMatches = ref<Array<{ from: number; to: number; match?: RegExpExecArray; matchStart?: number; codeBlockPmPos?: number }>>([])
  const currentIndex = ref(-1)
  const totalMatches = ref(0)

  return {
    currentQuery,
    currentMatches,
    currentIndex,
    totalMatches,
  }
})
