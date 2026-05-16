<template>
  <div class="document-outline">
    <div class="outline-header">
      <span>文档大纲</span>
      <button class="refresh-btn" @click="refreshOutline" title="刷新大纲">
        🔄
      </button>
    </div>
    <div class="outline-filters">
      <button
        v-for="level in [1, 2, 3, 4, 5, 6]"
        :key="level"
        class="filter-btn"
        :class="{ active: activeFilters.includes(level) }"
        @click="toggleFilter(level)"
      >
        H{{ level }}
      </button>
    </div>
    <div class="outline-tree" v-if="headings.length > 0">
      <div
        v-for="heading in filteredHeadings"
        :key="heading.id"
        class="outline-item"
        :class="`level-${heading.level}`"
        :class="{ active: activeHeadingId === heading.id }"
        @click="scrollToHeading(heading)"
      >
        <span class="heading-level">H{{ heading.level }}</span>
        <span class="heading-text">{{ heading.text }}</span>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>文档中没有标题</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'

interface OutlineHeading {
  level: number
  id: string
  text: string
  line: number
}

const tabsStore = useTabsStore()

const headings = ref<OutlineHeading[]>([])
const activeFilters = ref<number[]>([1, 2, 3, 4, 5, 6])
const activeHeadingId = ref<string | null>(null)

const filteredHeadings = computed(() => {
  return headings.value.filter(h => activeFilters.value.includes(h.level))
})

watch(
  () => tabsStore.activeTab?.content,
  (content) => {
    if (content) {
      parseHeadings(content)
    } else {
      headings.value = []
    }
  },
  { immediate: true }
)

function parseHeadings(content: string) {
  const lines = content.split('\n')
  const result: OutlineHeading[] = []

  lines.forEach((line, index) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim()
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      result.push({
        level,
        id,
        text,
        line: index + 1
      })
    }
  })

  headings.value = result
}

function refreshOutline() {
  const content = tabsStore.activeTab?.content
  if (content) {
    parseHeadings(content)
  }
}

function toggleFilter(level: number) {
  const index = activeFilters.value.indexOf(level)
  if (index > -1) {
    if (activeFilters.value.length > 1) {
      activeFilters.value.splice(index, 1)
    }
  } else {
    activeFilters.value.push(level)
    activeFilters.value.sort((a, b) => a - b)
  }
}

function scrollToHeading(heading: OutlineHeading) {
  activeHeadingId.value = heading.id

  const element = document.getElementById(heading.id)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } else {
    const textarea = document.querySelector('.source-editor, .split-source') as HTMLTextAreaElement
    if (textarea) {
      const lines = textarea.value.split('\n')
      let charIndex = 0
      for (let i = 0; i < heading.line - 1; i++) {
        charIndex += lines[i].length + 1
      }
      textarea.setSelectionRange(charIndex, charIndex)
      textarea.focus()
    }
  }
}

let unsubscribeContentChanged: (() => void) | null = null
let unsubscribeTabSwitched: (() => void) | null = null

onMounted(() => {
  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, ({ tabId }) => {
    console.log('[DocumentOutline] Content changed, refreshing outline for tab:', tabId)
    const activeTab = tabsStore.activeTab
    if (activeTab && activeTab.id === tabId) {
      parseHeadings(activeTab.content)
    }
  })

  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, ({ tabId }) => {
    console.log('[DocumentOutline] Tab switched, refreshing outline for tab:', tabId)
    const tab = tabsStore.tabs.get(tabId)
    if (tab) {
      parseHeadings(tab.content)
    }
  })
})

onUnmounted(() => {
  unsubscribeContentChanged?.()
  unsubscribeTabSwitched?.()
})
</script>

<style scoped lang="scss">
.document-outline {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.outline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border-color);
}

.refresh-btn {
  padding: 4px;
  border: none;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0.7;
  transition: all 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
    opacity: 1;
  }
}

.outline-filters {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
}

.filter-btn {
  padding: 2px 6px;
  border: 1px solid var(--border-color);
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
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

.outline-tree {
  flex: 1;
  overflow: auto;
  padding: 8px;
}

.outline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  transition: all 0.15s;
  border-left: 2px solid transparent;

  &:hover {
    background: var(--sidebar-hover-bg);
  }

  &.active {
    background: var(--sidebar-hover-bg);
    border-left-color: var(--primary-color);
  }

  &.level-1 {
    font-weight: 600;
    font-size: 13px;
  }

  &.level-2 {
    padding-left: 16px;
  }

  &.level-3 {
    padding-left: 24px;
  }

  &.level-4 {
    padding-left: 32px;
  }

  &.level-5 {
    padding-left: 40px;
  }

  &.level-6 {
    padding-left: 48px;
  }
}

.heading-level {
  padding: 1px 4px;
  background: var(--code-bg);
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  color: var(--text-secondary);
}

.heading-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
