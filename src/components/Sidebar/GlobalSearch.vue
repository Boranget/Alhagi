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
          @input="handleSearchInput"
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
        v-if="searchQuery && searchScope !== 'file'"
        class="search-btn link"
        :title="t('search.linkToCurrentFile')"
        @click="linkToCurrentFile"
      >
        🔗 {{ t('search.linkToCurrentFile') }}
      </button>
      <button
        v-if="replaceQuery && searchScope === 'file'"
        class="search-btn replace"
        @click="replaceInActiveFile"
      >
        {{ t('search.replacePlaceholder') }}
      </button>
      <button
        v-if="replaceQuery && searchScope === 'file'"
        class="search-btn replace-all"
        @click="replaceInAllTabs"
      >
        {{ t('search.replaceAll') }}
      </button>
    </div>
    <div class="search-scope">
      <button
        v-for="scope in searchScopes"
        :key="scope.id"
        class="scope-btn"
        :class="{ active: searchScope === scope.id }"
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
import { useWorkspaceSearch } from '@/composables/useWorkspaceSearch'
import { t } from '@/services/i18n'

const {
  searchQuery,
  replaceQuery,
  isSearching,
  results,
  totalMatches,
  options,
  expandedFiles,
  searchScope,
  performSearch,
  updateEditorHighlight,
  replaceInActiveFile,
  replaceInAllTabs,
  toggleExpand,
  handleMatchClick,
  setSearchScope,
  handleSearchInput,
  linkToCurrentFile
} = useWorkspaceSearch()

const searchScopes = [
  { id: 'file' as const, label: t('sidebar.currentFile') },
  { id: 'folder' as const, label: t('sidebar.currentFolder') },
  { id: 'all' as const, label: t('sidebar.allTabs') }
]

// 监听搜索条件变化，更新编辑器高亮
watch([searchQuery, () => options.caseSensitive, () => options.wholeWord, () => options.regex], () => {
  updateEditorHighlight()
})

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

  &.link {
    background: var(--success-color);
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
