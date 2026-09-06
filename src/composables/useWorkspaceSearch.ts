import { ref, reactive, computed, onUnmounted, onMounted, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useFileExplorerStore } from '@/stores/fileExplorer'
import { SearchConfig, findMatchesInContent } from '@/utils/search'
import { xssSanitizer } from '@/services/xssSanitizer'
import { debounce } from '@/utils/helpers'
import { useSearch } from './useSearch'
import { eventBus, AppEvents } from '@/events/eventBus'
import { useToast } from './useToast'

export type SearchScope = 'file' | 'folder' | 'all'
export type SearchMode = 'floating' | 'sidebar'

export interface SearchMatch {
  line: number
  column: number
  text: string
  highlightedText: string
  startIndex: number
  endIndex: number
}

export interface SearchResult {
  file: string
  fileName: string
  filePath?: string
  matches: SearchMatch[]
}

export function useWorkspaceSearch() {
  const tabsStore = useTabsStore()
  const fileStore = useFileExplorerStore()
  const searchService = useSearch()
  const toast = useToast()

  const isVisible = ref(false)
  const searchQuery = ref('')
  const replaceQuery = ref('')
  const isSearching = ref(false)
  const results = ref<SearchResult[]>([])
  const totalMatches = ref(0)
  const currentMatchIndex = ref(0)
  const searchScope = ref<SearchScope>('file')
  const searchMode = ref<SearchMode>('sidebar')
  const linkedFromGlobalSearch = ref(false)

  const options = reactive({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    include: '*.md',
    exclude: 'node_modules'
  })

  const expandedFiles = ref(new Set<string>())

  const matchCount = computed(() => totalMatches.value)
  const currentResult = computed(() => {
    if (results.value.length === 0) return null
    return results.value[currentMatchIndex.value] || null
  })

  function getSearchConfig(): SearchConfig {
    return {
      search: searchQuery.value,
      caseSensitive: options.caseSensitive,
      wholeWord: options.wholeWord,
      regexp: options.regex
    }
  }

  function updateEditorHighlight(select = true) {
    if (!searchService.value) {
      totalMatches.value = 0
      currentMatchIndex.value = 0
      return
    }

    if (!searchQuery.value.trim()) {
      searchService.value.clear()
      totalMatches.value = 0
      currentMatchIndex.value = 0
      return
    }

    const result = searchService.value.search({
      search: searchQuery.value,
      caseSensitive: options.caseSensitive,
      wholeWord: options.wholeWord,
      regexp: options.regex
    }, { select })

    totalMatches.value = result.total
    currentMatchIndex.value = result.current
  }

  function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function buildSearchPattern(): RegExp | null {
    if (!searchQuery.value.trim()) return null
    let pattern = options.regex ? searchQuery.value : escapeRegExp(searchQuery.value)
    if (options.wholeWord) pattern = `\\b${pattern}\\b`
    try {
      return new RegExp(pattern, options.caseSensitive ? 'g' : 'gi')
    } catch {
      return null
    }
  }

  function highlightMatch(text: string, match: string, startIndex: number): string {
    const before = text.substring(0, startIndex)
    const after = text.substring(startIndex + match.length)
    const escapedMatch = xssSanitizer.escapeHtml(match)
    return `${xssSanitizer.escapeHtml(before)}<mark>${escapedMatch}</mark>${xssSanitizer.escapeHtml(after)}`
  }

  function searchInContent(content: string, pattern: RegExp): SearchMatch[] {
    const matches: SearchMatch[] = []
    const lines = content.split('\n')
    lines.forEach((line, lineIndex) => {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(line)) !== null) {
        const highlightedText = highlightMatch(line, match[0], match.index)
        matches.push({
          line: lineIndex + 1,
          column: match.index + 1,
          text: line,
          highlightedText,
          startIndex: match.index,
          endIndex: match.index + match[0].length
        })
      }
    })
    return matches
  }

  function performSearch() {
    const pattern = buildSearchPattern()
    if (!pattern) {
      results.value = []
      totalMatches.value = 0
      currentMatchIndex.value = 0
      return
    }
    
    isSearching.value = true
    results.value = []
    totalMatches.value = 0
    currentMatchIndex.value = 0
    
    if (searchScope.value === 'file') {
      searchInActiveFile(pattern)
      updateEditorHighlight(false)
      isSearching.value = false
    } else if (searchScope.value === 'all') {
      searchInAllTabs(pattern)
      isSearching.value = false
    } else {
      searchInFolder(pattern)
    }
  }

  function searchInActiveFile(pattern: RegExp) {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      results.value = []
      totalMatches.value = 0
      isSearching.value = false
      return
    }
    const matches = searchInContent(activeTab.content, pattern)
    if (matches.length > 0) {
      results.value = [{ file: activeTab.id, fileName: activeTab.title, filePath: activeTab.filePath || undefined, matches }]
      totalMatches.value = matches.length
      expandedFiles.value.add(activeTab.id)
    } else {
      results.value = []
      totalMatches.value = 0
    }
    isSearching.value = false
  }

  function searchInAllTabs(pattern: RegExp) {
    const allTabs = tabsStore.getAllTabs()
    const searchResults: SearchResult[] = []
    let total = 0
    allTabs.forEach(tab => {
      const matches = searchInContent(tab.content, pattern)
      if (matches.length > 0) {
        searchResults.push({ file: tab.id, fileName: tab.title, filePath: tab.filePath || undefined, matches })
        total += matches.length
      }
    })
    results.value = searchResults
    totalMatches.value = total
    if (searchResults.length > 0) expandedFiles.value.add(searchResults[0].file)
  }

  function searchInFolder(pattern: RegExp) {
    const folderPath = fileStore.currentFolder
    if (!folderPath) {
      results.value = []
      isSearching.value = false
      return
    }
    if (window.electronAPI) {
      isSearching.value = true
      const searchOptions = {
        caseSensitive: options.caseSensitive,
        wholeWord: options.wholeWord,
        useRegex: options.regex,
        includePatterns: options.include ? [options.include] : ['.*\\.md$', '.*\\.markdown$', '.*\\.txt$'],
        excludePatterns: options.exclude ? options.exclude.split(',').map(s => s.trim()) : ['node_modules', '.git', 'dist']
      }
      window.electronAPI.searchInDirectory(folderPath, searchQuery.value, searchOptions).then(response => {
        if (response && response.success && response.data) {
          const groupedByFile = new Map<string, SearchResult>()
          response.data.forEach((result: { filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }) => {
            const fileName = result.filePath.split(/[/\\]/).pop() || result.filePath
            if (!groupedByFile.has(result.filePath)) {
              groupedByFile.set(result.filePath, { file: result.filePath, fileName, filePath: result.filePath, matches: [] })
            }
            const existing = groupedByFile.get(result.filePath)!
            const matchText = result.lineContent.substring(result.matchStart, result.matchEnd)
            const highlightedText = highlightMatch(result.lineContent, matchText, result.matchStart)
            existing.matches.push({ line: result.lineNumber, column: result.matchStart + 1, text: result.lineContent, highlightedText, startIndex: result.matchStart, endIndex: result.matchEnd })
          })
          const searchResults = Array.from(groupedByFile.values())
          results.value = searchResults
          totalMatches.value = searchResults.reduce((sum, r) => sum + r.matches.length, 0)
          if (searchResults.length > 0) expandedFiles.value.add(searchResults[0].file)
        }
      }).catch(error => {
        console.error('Search in directory failed:', error)
      }).finally(() => {
        isSearching.value = false
      })
    } else {
      const allTabs = tabsStore.getAllTabs()
      const searchResults: SearchResult[] = []
      let total = 0
      allTabs.filter(tab => tab.filePath && tab.filePath.startsWith(folderPath)).forEach(tab => {
        const matches = searchInContent(tab.content, pattern)
        if (matches.length > 0) {
          searchResults.push({ file: tab.id, fileName: tab.title, filePath: tab.filePath || undefined, matches })
          total += matches.length
        }
      })
      results.value = searchResults
      totalMatches.value = total
      if (searchResults.length > 0) expandedFiles.value.add(searchResults[0].file)
      isSearching.value = false
    }
  }

  function navigateNext() {
    if (searchScope.value === 'file') {
      if (searchService.value) {
        const result = searchService.value.findNext()
        currentMatchIndex.value = result.current
        totalMatches.value = result.total
      }
    } else {
      if (totalMatches.value === 0) return
      currentMatchIndex.value = (currentMatchIndex.value + 1) % totalMatches.value
      scrollToMatch(currentMatchIndex.value)
    }
  }

  function navigatePrev() {
    if (searchScope.value === 'file') {
      if (searchService.value) {
        const result = searchService.value.findPrev()
        currentMatchIndex.value = result.current
        totalMatches.value = result.total
      }
    } else {
      if (totalMatches.value === 0) return
      currentMatchIndex.value = currentMatchIndex.value === 0 ? totalMatches.value - 1 : currentMatchIndex.value - 1
      scrollToMatch(currentMatchIndex.value)
    }
  }

  function scrollToMatch(index: number) {
    const match = results.value[index]
    if (!match) return
    const tab = tabsStore.getAllTabs().find(t => t.id === match.file)
    if (tab && tab.id !== tabsStore.activeTabId) {
      tabsStore.switchTab(tab.id)
    }
    const config = getSearchConfig()
    const activeTab = tabsStore.activeTab
    if (activeTab) {
      const matches = findMatchesInContent(activeTab.content, config)
      const matchInfo = matches[index]
      if (matchInfo) {
        tabsStore.updateTab(tabsStore.activeTabId!, { cursor: { from: matchInfo.from, to: matchInfo.to } })
      }
    }
  }

  function replaceSingle() {
    if (searchScope.value === 'file') {
      if (searchService.value) {
        const result = searchService.value.replaceNext(replaceQuery.value)
        currentMatchIndex.value = result.current
        totalMatches.value = result.total
      }
    } else {
      if (totalMatches.value === 0) return
      const activeTab = tabsStore.activeTab
      if (!activeTab) return
      const pattern = buildSearchPattern()
      if (!pattern) return
      const newContent = activeTab.content.replace(pattern, replaceQuery.value)
      tabsStore.updateTab(activeTab.id, { content: newContent, isDirty: true })
      performSearch()
    }
  }

  function replaceAll() {
    if (searchScope.value === 'file') {
      if (searchService.value) {
        const result = searchService.value.replaceAll(replaceQuery.value)
        if (result.replaced > 0) {
          performSearch()
        }
      }
    } else if (searchScope.value === 'all') {
      replaceInAllTabs()
    } else if (searchScope.value === 'folder') {
      replaceInFolder()
    }
  }

  function replaceInActiveFile() {
    const activeTab = tabsStore.activeTab
    if (!activeTab) return
    const pattern = buildSearchPattern()
    if (!pattern) return
    const newContent = activeTab.content.replace(pattern, replaceQuery.value)
    tabsStore.updateTab(activeTab.id, { content: newContent, isDirty: true })
    performSearch()
  }

  function replaceInAllTabs() {
    const pattern = buildSearchPattern()
    if (!pattern) return
    let replaceCount = 0
    const allTabs = tabsStore.getAllTabs()
    allTabs.forEach((tab) => {
      const matches = tab.content.match(pattern)
      if (matches) {
        const newContent = tab.content.replace(pattern, replaceQuery.value)
        tabsStore.updateTab(tab.id, { content: newContent, isDirty: true })
        replaceCount += matches.length
      }
    })
    if (replaceCount > 0) toast.success(`已替换 ${replaceCount} 处匹配`)
    performSearch()
  }

  function replaceInFolder() {
    // 文件夹范围替换需要后端支持，这里暂时只处理已打开的标签页
    const pattern = buildSearchPattern()
    if (!pattern) return
    const folderPath = fileStore.currentFolder
    if (!folderPath) return
    
    let replaceCount = 0
    const allTabs = tabsStore.getAllTabs()
    allTabs.filter(tab => tab.filePath && tab.filePath.startsWith(folderPath)).forEach((tab) => {
      const matches = tab.content.match(pattern)
      if (matches) {
        const newContent = tab.content.replace(pattern, replaceQuery.value)
        tabsStore.updateTab(tab.id, { content: newContent, isDirty: true })
        replaceCount += matches.length
      }
    })
    if (replaceCount > 0) toast.success(`已替换 ${replaceCount} 处匹配`)
    performSearch()
  }

  function toggleExpand(file: string) {
    if (expandedFiles.value.has(file)) expandedFiles.value.delete(file)
    else expandedFiles.value.add(file)
  }

  function handleMatchClick(result: SearchResult, _match: SearchMatch) {
    const tab = tabsStore.getAllTabs().find(t => t.id === result.file)
    if (tab) {
      tabsStore.switchTab(tab.id)
      if (searchMode.value === 'floating') {
        linkedFromGlobalSearch.value = true
        searchScope.value = 'file'
        setTimeout(() => {
          linkedFromGlobalSearch.value = false
        }, 1000)
      }
    }
  }

  function linkToCurrentFile() {
    if (!searchQuery.value.trim() || searchScope.value === 'file') return
    searchScope.value = 'file'
    linkedFromGlobalSearch.value = true
    performSearch()
    updateEditorHighlight()
    setTimeout(() => {
      linkedFromGlobalSearch.value = false
    }, 1000)
  }

  function syncFromGlobalSearch(query: string, scope: SearchScope = 'folder') {
    searchQuery.value = query
    searchScope.value = scope
    performSearch()
    updateEditorHighlight()
  }

  function setSearchScope(scope: SearchScope) {
    searchScope.value = scope
    if (searchQuery.value) {
      performSearch()
      if (scope === 'file') {
        updateEditorHighlight(false)
      } else {
        searchService.value?.clear()
      }
    }
  }

  function show(mode: SearchMode = 'sidebar') {
    isVisible.value = true
    searchMode.value = mode
    if (mode === 'floating') {
      searchScope.value = 'file'
    }
  }

  function hide() {
    isVisible.value = false
    searchQuery.value = ''
    replaceQuery.value = ''
    totalMatches.value = 0
    currentMatchIndex.value = 0
    results.value = []
    expandedFiles.value.clear()
    searchService.value?.clear()
  }

  const debouncedSearch = debounce(() => {
    performSearch()
    if (searchScope.value === 'file') {
      updateEditorHighlight(false)
    }
  }, 300)

  function handleSearchInput() {
    debouncedSearch()
  }

  // 监听搜索选项变化，自动触发重新搜索
  watch(
    () => [options.caseSensitive, options.wholeWord, options.regex],
    () => {
      if (searchQuery.value.trim()) {
        performSearch()
        if (searchScope.value === 'file') {
          updateEditorHighlight(false)
        }
      }
    }
  )

  let unsubscribeContentChanged: (() => void) | null = null

  onMounted(() => {
    // 监听内容变化事件，当文档内容变化时更新搜索高亮
    unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, () => {
      // 只有在有搜索查询时才重新更新
      if (searchQuery.value.trim() && searchScope.value === 'file') {
        updateEditorHighlight(false)
      }
    })
  })

  onUnmounted(() => {
    unsubscribeContentChanged?.()
    searchService.value?.clear()
  })

  return {
    isVisible,
    searchQuery,
    replaceQuery,
    isSearching,
    results,
    totalMatches,
    currentMatchIndex,
    matchCount,
    currentResult,
    searchScope,
    searchMode,
    linkedFromGlobalSearch,
    options,
    expandedFiles,
    performSearch,
    updateEditorHighlight,
    navigateNext,
    navigatePrev,
    replaceSingle,
    replaceAll,
    replaceInActiveFile,
    replaceInAllTabs,
    replaceInFolder,
    toggleExpand,
    handleMatchClick,
    setSearchScope,
    linkToCurrentFile,
    syncFromGlobalSearch,
    show,
    hide,
    handleSearchInput,
    debouncedSearch
  }
}
