<template>
  <div class="global-search">
    <div class="search-header">
      <span>{{ t('sidebar.globalSearch') }}</span>
    </div>
    <div class="search-inputs">
      <div class="input-group">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="t('search.searchPlaceholder')"
          @input="handleSearch"
          @keydown.enter="performSearch"
        >
        <input
          v-model="replaceQuery"
          type="text"
          class="replace-input"
          :placeholder="t('search.replacePlaceholder')"
        >
      </div>
      <div class="search-options">
        <label class="option">
          <input
            v-model="options.caseSensitive"
            type="checkbox"
          >
          <span>{{ t('search.caseSensitive') }}</span>
        </label>
        <label class="option">
          <input
            v-model="options.wholeWord"
            type="checkbox"
          >
          <span>{{ t('search.wholeWord') }}</span>
        </label>
        <label class="option">
          <input
            v-model="options.regex"
            type="checkbox"
          >
          <span>{{ t('search.regex') }}</span>
        </label>
      </div>
      <div class="search-patterns">
        <div class="pattern-row">
          <label class="pattern-label">{{ t('search.includePattern') }}:</label>
          <input
            v-model="options.include"
            type="text"
            class="pattern-input"
            placeholder="*.md, *.txt"
          >
        </div>
        <div class="pattern-row">
          <label class="pattern-label">{{ t('search.excludePattern') }}:</label>
          <input
            v-model="options.exclude"
            type="text"
            class="pattern-input"
            placeholder="node_modules, .git"
          >
        </div>
      </div>
    </div>
    <div class="search-actions">
      <button
        class="search-btn"
        @click="performSearch"
      >
        {{ t('sidebar.globalSearch') }}
      </button>
      <button
        v-if="replaceQuery && activeSearchTarget === 'file'"
        class="search-btn replace"
        @click="handleReplace"
      >
        {{ t('search.replacePlaceholder') }}
      </button>
      <button
        v-if="replaceQuery && activeSearchTarget === 'file'"
        class="search-btn replace-all"
        @click="handleReplaceAll"
      >
        {{ t('search.replaceAll') }}
      </button>
    </div>
    <div class="search-scope">
      <button
        v-for="scope in searchScopes"
        :key="scope.id"
        class="scope-btn"
        :class="{ active: activeSearchTarget === scope.id }"
        @click="setSearchScope(scope.id)"
      >
        {{ scope.label }}
      </button>
    </div>
    <div class="search-results">
      <div
        v-if="!searchQuery"
        class="empty-state"
      >
        {{ t('search.searchPlaceholder') }}
      </div>
      <div
        v-else-if="isSearching"
        class="empty-state"
      >
        {{ t('sidebar.globalSearch') }}...
      </div>
      <div
        v-else-if="results.length === 0"
        class="empty-state"
      >
        {{ t('search.noResults') }}
      </div>
      <div
        v-else
        class="results-list"
      >
        <div class="results-count">
          {{ results.length }} {{ t('common.openFile') }}，{{ totalMatches }} 处匹配
        </div>
        <div
          v-for="result in results"
          :key="result.file"
          class="result-group"
        >
          <div
            class="result-file"
            @click="toggleExpand(result.file)"
          >
            <span class="expand-icon">{{ expandedFiles.has(result.file) ? '▼' : '▶' }}</span>
            <span class="file-name">{{ result.fileName }}</span>
            <span class="match-count">({{ result.matches.length }})</span>
          </div>
          <div
            v-if="expandedFiles.has(result.file)"
            class="result-matches"
          >
            <div
              v-for="(match, idx) in result.matches"
              :key="idx"
              class="match-item"
              @click="handleMatchClick(result, match)"
            >
              <span class="match-line">{{ match.line }}:{{ match.column }}</span>
              <span
                class="match-text"
                v-html="match.highlightedText"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { useFileService } from '@/services/fileService'
import { debounce } from '@/utils/helpers'
import { xssSanitizer } from '@/services/xssSanitizer'
import { t } from '@/services/i18n'
import { useEditorManager } from '@/managers/editorManager'
import type { SearchConfig } from '@/managers/searchHighlightPlugin'

const { setSearchHighlight, clearSearchHighlight } = useEditorManager()

interface SearchMatch {
  line: number
  column: number
  text: string
  highlightedText: string
  startIndex: number
  endIndex: number
}

interface SearchResult {
  file: string
  fileName: string
  filePath?: string
  matches: SearchMatch[]
}

const tabsStore = useTabsStore()
const fileService = useFileService()

const searchQuery = ref('')
const replaceQuery = ref('')
const isSearching = ref(false)
const results = ref<SearchResult[]>([])
const totalMatches = ref(0)
const expandedFiles = ref(new Set<string>())
const activeSearchTarget = ref<'file' | 'folder' | 'all'>('file')

const searchScopes = [
  { id: 'file' as const, label: t('sidebar.currentFile') },
  { id: 'folder' as const, label: t('sidebar.currentFolder') },
  { id: 'all' as const, label: t('sidebar.allTabs') }
]

const options = reactive({
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  include: '*.md',
  exclude: 'node_modules'
})

// 监听搜索条件变化，更新编辑器高亮
watch([searchQuery, () => options.caseSensitive, () => options.wholeWord, () => options.regex], () => {
  updateEditorHighlight()
})

// 组件卸载时清除搜索高亮
onUnmounted(() => {
  clearSearchHighlight()
})

function updateEditorHighlight() {
  if (!searchQuery.value.trim()) {
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
}

const handleSearch = debounce(() => {
  performSearch()
  updateEditorHighlight()
}, 300)

function setSearchScope(scope: 'file' | 'folder' | 'all') {
  activeSearchTarget.value = scope
  if (searchQuery.value) {
    performSearch()
    updateEditorHighlight()
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildSearchPattern(): RegExp | null {
  if (!searchQuery.value.trim()) {
    return null
  }

  let pattern = options.regex ? searchQuery.value : escapeRegExp(searchQuery.value)
  
  if (options.wholeWord) {
    pattern = `\\b${pattern}\\b`
  }

  try {
    const flags = options.caseSensitive ? 'g' : 'gi'
    return new RegExp(pattern, flags)
  } catch {
    return null
  }
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

function highlightMatch(text: string, match: string, startIndex: number): string {
  const before = text.substring(0, startIndex)
  const after = text.substring(startIndex + match.length)
  const escapedMatch = xssSanitizer.escapeHtml(match)
  return `${xssSanitizer.escapeHtml(before)}<mark>${escapedMatch}</mark>${xssSanitizer.escapeHtml(after)}`
}

function performSearch() {
  const pattern = buildSearchPattern()
  if (!pattern) {
    results.value = []
    totalMatches.value = 0
    return
  }

  isSearching.value = true
  results.value = []
  totalMatches.value = 0

  setTimeout(() => {
    if (activeSearchTarget.value === 'file') {
      searchInActiveFile(pattern)
    } else if (activeSearchTarget.value === 'all') {
      searchInAllTabs(pattern)
    } else {
      searchInFolder(pattern)
    }
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
    results.value = [{
      file: activeTab.id,
      fileName: activeTab.title,
      filePath: activeTab.filePath || undefined,
      matches
    }]
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
      searchResults.push({
        file: tab.id,
        fileName: tab.title,
        filePath: tab.filePath || undefined,
        matches
      })
      total += matches.length
    }
  })

  results.value = searchResults
  totalMatches.value = total
  if (searchResults.length > 0) {
    expandedFiles.value.add(searchResults[0].file)
  }
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
            groupedByFile.set(result.filePath, {
              file: result.filePath,
              fileName: fileName,
              filePath: result.filePath,
              matches: []
            })
          }

          const existing = groupedByFile.get(result.filePath)!
          const highlightedText = highlightMatch(result.lineContent, pattern, result.matchStart)
          existing.matches.push({
            line: result.lineNumber,
            column: result.matchStart + 1,
            text: result.lineContent,
            highlightedText,
            startIndex: result.matchStart,
            endIndex: result.matchEnd
          })
        })

        const searchResults = Array.from(groupedByFile.values())
        results.value = searchResults
        totalMatches.value = searchResults.reduce((sum, r) => sum + r.matches.length, 0)

        if (searchResults.length > 0) {
          expandedFiles.value.add(searchResults[0].file)
        }
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
        searchResults.push({
          file: tab.id,
          fileName: tab.title,
          filePath: tab.filePath || undefined,
          matches
        })
        total += matches.length
      }
    })

    results.value = searchResults
    totalMatches.value = total
    if (searchResults.length > 0) {
      expandedFiles.value.add(searchResults[0].file)
    }
  }
}

function handleReplace() {
  if (!searchQuery.value || !replaceQuery.value) {
    return
  }

  const activeTab = tabsStore.activeTab
  if (!activeTab) {
    return
  }

  const pattern = buildSearchPattern()
  if (!pattern) {
    return
  }

  const newContent = activeTab.content.replace(pattern, replaceQuery.value)
  tabsStore.updateTab(activeTab.id, {
    content: newContent,
    isDirty: true
  })

  performSearch()
}

function handleReplaceAll() {
  if (!searchQuery.value || !replaceQuery.value) {
    return
  }

  if (activeSearchTarget.value === 'file') {
    // 只替换当前文件
    replaceInActiveFile()
  } else if (activeSearchTarget.value === 'all') {
    // 替换所有标签页
    replaceInAllTabs()
  }
}

function replaceInActiveFile() {
  const activeTab = tabsStore.activeTab
  if (!activeTab) {
    return
  }

  const pattern = buildSearchPattern()
  if (!pattern) {
    return
  }

  const newContent = activeTab.content.replace(pattern, replaceQuery.value)
  tabsStore.updateTab(activeTab.id, {
    content: newContent,
    isDirty: true
  })

  performSearch()
}

function replaceInAllTabs() {
  const pattern = buildSearchPattern()
  if (!pattern) {
    return
  }

  let replaceCount = 0
  const allTabs = tabsStore.getAllTabs()
  allTabs.forEach((tab) => {
    const matches = tab.content.match(pattern)
    if (matches) {
      const newContent = tab.content.replace(pattern, replaceQuery.value)
      tabsStore.updateTab(tab.id, {
        content: newContent,
        isDirty: true
      })
      replaceCount += matches.length
    }
  })

  if (replaceCount > 0) {
    alert(`已替换 ${replaceCount} 处匹配`)
  }

  performSearch()
}

function toggleExpand(file: string) {
  if (expandedFiles.value.has(file)) {
    expandedFiles.value.delete(file)
  } else {
    expandedFiles.value.add(file)
  }
}

function handleMatchClick(result: SearchResult, _match: SearchMatch) {
  const tab = tabsStore.getAllTabs().find(t => t.id === result.file)
  if (tab) {
    tabsStore.switchTab(tab.id)
  }
}
</script>

<style scoped lang="scss">
.global-search {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.search-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.search-inputs {
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.search-input,
.replace-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.search-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.search-patterns {
  margin-top: 8px;
}

.pattern-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.pattern-label {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 40px;
}

.pattern-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 11px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.option {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;

  input[type="checkbox"] {
    cursor: pointer;
  }
}

.search-actions {
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.search-btn {
  padding: 4px 12px;
  border: none;
  background: var(--primary-color);
  color: white;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    opacity: 0.9;
  }

  &.replace {
    background: var(--warning-color);
  }

  &.replace-all {
    background: var(--danger-color);
  }
}

.search-scope {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
}

.scope-btn {
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &.active {
    background: var(--primary-color);
    color: white;
    border-color: var(--primary-color);
  }
}

.search-results {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 20px;
}

.results-list {
  font-size: 12px;
}

.results-count {
  padding: 4px 8px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.result-group {
  margin-bottom: 8px;
}

.result-file {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.expand-icon {
  font-size: 10px;
  color: var(--text-secondary);
}

.file-name {
  flex: 1;
  color: var(--text-primary);
}

.match-count {
  color: var(--text-secondary);
  font-size: 11px;
}

.result-matches {
  padding-left: 20px;
}

.match-item {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.match-line {
  color: var(--primary-color);
  font-size: 11px;
  min-width: 60px;
  flex-shrink: 0;
}

.match-text {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  mark {
    background: var(--primary-color);
    color: white;
    padding: 1px 4px;
    border-radius: 2px;
  }
}
</style>
