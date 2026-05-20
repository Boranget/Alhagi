<template>
  <div class="sidebar">
    <div class="sidebar-tabs">
      <button
        v-for="tab in sidebarTabs"
        :key="tab.id"
        class="sidebar-tab"
        :class="{ active: activeSidebarTab === tab.id }"
        :title="tab.label"
        @click="activeSidebarTab = tab.id"
      >
        <Icon
          :name="tab.icon"
          size="sm"
        />
      </button>
    </div>
    <div class="sidebar-content">
      <div
        v-show="activeSidebarTab === 'files'"
        class="sidebar-panel"
      >
        <div class="panel-header">
          <span>文件资源管理器</span>
          <button
            class="panel-action"
            @click="openFolder"
          >
            打开文件夹
          </button>
        </div>
        <div class="file-tree">
          <div
            v-if="!currentFolder"
            class="empty-state"
          >
            点击"打开文件夹"开始
          </div>
          <div
            v-else
            class="tree-node"
          >
            <div
              class="folder-header"
              @click="toggleFolder"
            >
              <Icon 
                :name="isFolderExpanded ? 'chevron-down' : 'chevron-right'" 
                size="sm" 
                class="folder-icon"
              />
              <span class="folder-name">{{ currentFolderName }}</span>
            </div>
            <div
              v-show="isFolderExpanded"
              class="folder-content"
            >
              <div
                v-for="file in files"
                :key="file.path"
                class="file-item"
                :class="{ active: activeFile === file.path }"
                @click="openFile(file.path)"
              >
                <Icon
                  name="file"
                  size="sm"
                />
                <span class="file-name">{{ file.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        v-show="activeSidebarTab === 'search'"
        class="sidebar-panel"
      >
        <div class="search-input-wrapper">
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索文件..."
            @input="handleSearch"
          >
        </div>
        <div class="search-results">
          <div
            v-for="result in searchResults"
            :key="result.path"
            class="search-result-item"
            @click="openFile(result.path)"
          >
            <div class="result-path">
              {{ result.path }}
            </div>
            <div class="result-preview">
              {{ result.preview }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-show="activeSidebarTab === 'outline'"
        class="sidebar-panel"
      >
        <div class="panel-header">
          <span>文档大纲</span>
        </div>
        <div class="outline-tree">
          <div
            v-for="heading in headings"
            :key="heading.id"
            class="outline-item"
            :class="`level-${heading.level}`"
            @click="scrollToHeading(heading.id)"
          >
            {{ heading.text }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { debounce } from '@/utils/helpers'
import { Icon } from '@/components/Icons'

const tabsStore = useTabsStore()

const activeSidebarTab = ref<'files' | 'search' | 'outline'>('files')
const currentFolder = ref<string | null>(null)
const isFolderExpanded = ref(false)
const activeFile = ref<string | null>(null)
const files = ref<Array<{ name: string; path: string }>>([])
const searchQuery = ref('')
const searchResults = ref<Array<{ path: string; preview: string }>>([])
const headings = ref<Array<{ level: number; id: string; text: string }>>([])

const sidebarTabs = [
  { id: 'files' as const, label: '文件资源管理器', icon: 'folder' },
  { id: 'search' as const, label: '搜索', icon: 'search' },
  { id: 'outline' as const, label: '文档大纲', icon: 'list' }
]

const currentFolderName = computed(() => {
  if (!currentFolder.value) return ''
  const parts = currentFolder.value.split(/[/\\]/)
  return parts[parts.length - 1] || currentFolder.value
})

watch(() => tabsStore.activeTab?.content, (content) => {
  if (content) {
    parseHeadings(content)
  }
}, { immediate: true })

function parseHeadings(content: string) {
  const lines = content.split('\n')
  const result: Array<{ level: number; id: string; text: string }> = []
  
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      result.push({ level, id, text })
    }
  }
  
  headings.value = result
}

function openFolder() {
  // Open folder dialog
}

function toggleFolder() {
  isFolderExpanded.value = !isFolderExpanded.value
}

async function openFile(filePath: string) {
  // Open file handler
}

const handleSearch = debounce(() => {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }
  // Search implementation
}, 300)

function scrollToHeading(id: string) {
  const element = document.getElementById(id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}
</script>

<style scoped lang="scss">
.sidebar {
  width: 280px;
  min-width: 200px;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
}

.sidebar-tabs {
  display: flex;
  padding: 4px;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
  color: var(--text-secondary);

  &:hover {
    background: var(--sidebar-tab-hover-bg);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
}

.sidebar-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.panel-action {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--primary-color);
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--primary-color);
    color: white;
  }
}

.file-tree {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

.tree-node {
  font-size: 13px;
}

.folder-header {
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

.folder-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.folder-name {
  color: var(--text-primary);
}

.folder-content {
  padding-left: 16px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-primary);

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-input-wrapper {
  padding: 8px;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--input-bg);
  color: var(--text-primary);
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.search-results {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.search-result-item {
  padding: 8px;
  margin-bottom: 4px;
  background: var(--result-item-bg);
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.result-path {
  font-size: 12px;
  color: var(--primary-color);
  margin-bottom: 4px;
}

.result-preview {
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline-tree {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.outline-item {
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-primary);
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &.level-1 { padding-left: 8px; font-weight: 600; }
  &.level-2 { padding-left: 16px; }
  &.level-3 { padding-left: 24px; }
  &.level-4 { padding-left: 32px; }
  &.level-5 { padding-left: 40px; }
  &.level-6 { padding-left: 48px; }
}
</style>
