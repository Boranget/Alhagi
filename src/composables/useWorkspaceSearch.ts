import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useFileService } from '@/services/fileService'
import { SearchConfig, findMatchesInContent } from '@/utils/search'
import { xssSanitizer } from '@/services/xssSanitizer'
import { debounce } from '@/utils/helpers'
import { useEditorSearch } from '@/managers/crepeEditorManager'

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
  const fileService = useFileService()
  const { setSearchHighlight, clearSearchHighlight } = useEditorSearch()

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

  function updateEditorHighlight() {
    if (!searchQuery.value.trim()) {
      clearSearchHighlight()
      return
    }
    setSearchHighlight(getSearchConfig())
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
    setTimeout(() => {
      if (searchScope.value === 'file') searchInActiveFile(pattern)
      else if (searchScope.value === 'all') searchInAllTabs(pattern)
      else searchInFolder(pattern)
      isSearching.value = false
    }, 50)
  }

  function searchInActiveFile(pattern: RegExp) {
    const activeTab = tabsStore.activeTab
    if (!activeTab) {
      results.value = []
      return
    }
    const matches = searchInContent(activeTab.content, pattern)
    if (matches.length > 0) {
      results.value = [{ file: activeTab.id, fileName: activeTab.title, filePath: activeTab.filePath || undefined, matches }]
      totalMatches.value = matches.length
      expandedFiles.value.add(activeTab.id)
    }
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
    const folderPath = fileService.currentFolder?.value
    if (!folderPath) {
      results.value = []
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
    }
  }

  function navigateNext() {
    if (totalMatches.value === 0) return
    currentMatchIndex.value = (currentMatchIndex.value + 1) % totalMatches.value
    scrollToMatch(currentMatchIndex.value)
  }

  function navigatePrev() {
    if (totalMatches.value === 0) return
    currentMatchIndex.value = currentMatchIndex.value === 0 ? totalMatches.value - 1 : currentMatchIndex.value - 1
    scrollToMatch(currentMatchIndex.value)
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
    if (totalMatches.value === 0 || !replaceQuery.value) return
    const activeTab = tabsStore.activeTab
    if (!activeTab) return
    const pattern = buildSearchPattern()
    if (!pattern) return
    const newContent = activeTab.content.replace(pattern, replaceQuery.value)
    tabsStore.updateTab(activeTab.id, { content: newContent, isDirty: true })
    performSearch()
  }

  function replaceAll() {
    if (totalMatches.value === 0 || !replaceQuery.value) return
    if (searchScope.value === 'file') replaceInActiveFile()
    else if (searchScope.value === 'all') replaceInAllTabs()
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
    if (replaceCount > 0) alert(`已替换 ${replaceCount} 处匹配`)
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
      updateEditorHighlight()
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
    clearSearchHighlight()
  }

  const debouncedSearch = debounce(() => {
    performSearch()
    updateEditorHighlight()
  }, 300)

  function handleSearchInput() {
    debouncedSearch()
  }

  watch([searchQuery, () => options.caseSensitive, () => options.wholeWord, () => options.regex], () => {
    if (searchMode.value === 'sidebar') {
      performSearch()
      updateEditorHighlight()
    }
  })

  onUnmounted(() => {
    clearSearchHighlight()
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
