import { ref, reactive, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useEditorManager } from '@/managers/editorManager'
import { SearchConfig, findMatchesInContent, replaceAllInContent, replaceSingleMatch, MatchRange } from '@/utils/search'
import { debounce } from '@/utils/helpers'

export function useSearch() {
  const { setSearchHighlight, clearSearchHighlight } = useEditorManager()
  const tabsStore = useTabsStore()

  const isVisible = ref(false)
  const searchQuery = ref('')
  const replaceQuery = ref('')
  const matchCount = ref(0)
  const currentMatchIndex = ref(0)
  const searchResults = ref<MatchRange[]>([])

  const options = reactive({
    caseSensitive: false,
    wholeWord: false,
    regex: false
  })

  const performSearch = () => {
    if (!searchQuery.value.trim()) {
      matchCount.value = 0
      currentMatchIndex.value = 0
      searchResults.value = []
      clearSearchHighlight()
      return
    }

    const config: SearchConfig = {
      search: searchQuery.value,
      caseSensitive: options.caseSensitive,
      wholeWord: options.wholeWord,
      regexp: options.regex
    }

    setSearchHighlight(config)

    const activeTab = tabsStore.activeTab
    if (activeTab) {
      const matches = findMatchesInContent(activeTab.content, config)
      matchCount.value = matches.length
      searchResults.value = matches

      if (matches.length > 0) {
        currentMatchIndex.value = 0
        scrollToMatch(0)
      }
    }
  }

  const debouncedSearch = debounce(performSearch, 150)

  const navigateNext = () => {
    if (matchCount.value === 0) return
    currentMatchIndex.value = (currentMatchIndex.value + 1) % matchCount.value
    scrollToMatch(currentMatchIndex.value)
  }

  const navigatePrev = () => {
    if (matchCount.value === 0) return
    currentMatchIndex.value = currentMatchIndex.value === 0
      ? matchCount.value - 1
      : currentMatchIndex.value - 1
    scrollToMatch(currentMatchIndex.value)
  }

  const scrollToMatch = (index: number) => {
    const match = searchResults.value[index]
    if (!match) return

    tabsStore.updateTab(tabsStore.activeTabId!, {
      cursor: { from: match.from, to: match.to }
    })
  }

  const replaceSingle = () => {
    if (matchCount.value === 0 || !replaceQuery.value) return

    const activeTab = tabsStore.activeTab
    if (!activeTab) return

    const match = searchResults.value[currentMatchIndex.value]
    if (!match) return

    const newContent = replaceSingleMatch(activeTab.content, match, replaceQuery.value)
    tabsStore.updateTab(activeTab.id, {
      content: newContent,
      isDirty: true
    })

    performSearch()
  }

  const replaceAll = () => {
    if (matchCount.value === 0 || !replaceQuery.value) return

    const activeTab = tabsStore.activeTab
    if (!activeTab) return

    const config: SearchConfig = {
      search: searchQuery.value,
      caseSensitive: options.caseSensitive,
      wholeWord: options.wholeWord,
      regexp: options.regex
    }

    const newContent = replaceAllInContent(activeTab.content, config, replaceQuery.value)
    tabsStore.updateTab(activeTab.id, {
      content: newContent,
      isDirty: true
    })

    performSearch()
  }

  const show = () => {
    isVisible.value = true
  }

  const hide = () => {
    isVisible.value = false
    searchQuery.value = ''
    replaceQuery.value = ''
    matchCount.value = 0
    currentMatchIndex.value = 0
    searchResults.value = []
    clearSearchHighlight()
  }

  const handleSearchInput = () => {
    debouncedSearch()
  }

  watch([searchQuery, () => options.caseSensitive, () => options.wholeWord, () => options.regex], () => {
    performSearch()
  })

  return {
    isVisible,
    searchQuery,
    replaceQuery,
    matchCount,
    currentMatchIndex,
    searchResults,
    options,
    performSearch,
    debouncedSearch,
    handleSearchInput,
    navigateNext,
    navigatePrev,
    replaceSingle,
    replaceAll,
    show,
    hide
  }
}

