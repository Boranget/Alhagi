<template>
  <div class="global-search">
    <div class="search-header">
      <span>搜索</span>
    </div>
    <div class="search-inputs">
      <div class="input-group">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="搜索文件..."
          @input="handleSearch"
        />
        <input
          v-model="replaceQuery"
          type="text"
          class="replace-input"
          placeholder="替换为..."
        />
      </div>
      <div class="search-options">
        <label class="option">
          <input v-model="options.caseSensitive" type="checkbox" />
          <span>区分大小写</span>
        </label>
        <label class="option">
          <input v-model="options.wholeWord" type="checkbox" />
          <span>全字匹配</span>
        </label>
        <label class="option">
          <input v-model="options.regex" type="checkbox" />
          <span>正则表达式</span>
        </label>
      </div>
    </div>
    <div class="search-actions">
      <button class="search-btn" @click="handleSearch">搜索</button>
      <button v-if="replaceQuery" class="search-btn replace" @click="handleReplace">
        替换
      </button>
      <button v-if="replaceQuery" class="search-btn replace-all" @click="handleReplaceAll">
        全部替换
      </button>
    </div>
    <div class="search-results">
      <div v-if="!searchQuery" class="empty-state">
        输入搜索内容开始搜索
      </div>
      <div v-else-if="isSearching" class="empty-state">
        搜索中...
      </div>
      <div v-else-if="results.length === 0" class="empty-state">
        未找到匹配结果
      </div>
      <div v-else class="results-list">
        <div class="results-count">
          {{ results.length }} 个文件，{{ totalMatches }} 处匹配
        </div>
        <div
          v-for="result in results"
          :key="result.file"
          class="result-group"
        >
          <div class="result-file" @click="toggleExpand(result.file)">
            <span class="expand-icon">{{ expandedFiles.has(result.file) ? '▼' : '▶' }}</span>
            <span class="file-name">{{ result.file }}</span>
            <span class="match-count">({{ result.matches.length }})</span>
          </div>
          <div v-if="expandedFiles.has(result.file)" class="result-matches">
            <div
              v-for="(match, idx) in result.matches"
              :key="idx"
              class="match-item"
              @click="handleMatchClick(result.file, match)"
            >
              <span class="match-line">{{ match.line }}:{{ match.column }}</span>
              <span class="match-text">{{ match.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { debounce } from '@/utils/helpers'

interface SearchMatch {
  line: number
  column: number
  text: string
}

interface SearchResult {
  file: string
  matches: SearchMatch[]
}

const tabsStore = useTabsStore()

const searchQuery = ref('')
const replaceQuery = ref('')
const isSearching = ref(false)
const results = ref<SearchResult[]>([])
const totalMatches = ref(0)
const expandedFiles = ref(new Set<string>())

const options = reactive({
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  include: '*.md',
  exclude: 'node_modules'
})

const handleSearch = debounce(() => {
  performSearch()
}, 300)

function performSearch() {
  if (!searchQuery.value.trim()) {
    results.value = []
    totalMatches.value = 0
    return
  }

  isSearching.value = true
  
  setTimeout(() => {
    results.value = []
    totalMatches.value = 0
    isSearching.value = false
  }, 500)
}

function handleReplace() {
  console.log('Replace:', searchQuery.value, 'with:', replaceQuery.value)
}

function handleReplaceAll() {
  console.log('Replace all:', searchQuery.value, 'with:', replaceQuery.value)
}

function toggleExpand(file: string) {
  if (expandedFiles.value.has(file)) {
    expandedFiles.value.delete(file)
  } else {
    expandedFiles.value.add(file)
  }
}

function handleMatchClick(file: string, match: SearchMatch) {
  console.log('Navigate to:', file, 'line:', match.line, 'column:', match.column)
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
}

.match-text {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
