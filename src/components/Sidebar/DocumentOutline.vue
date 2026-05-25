<template>
  <div class="document-outline">
    <div class="outline-header">
      <span>{{ t('documentOutline') }}</span>
    </div>
    <div
      v-if="treeData.length > 0"
      class="outline-tree"
    >
      <OutlineTreeItem
        v-for="(node, index) in treeData"
        :key="node.slug + '-' + index"
        :node="node"
        :active-pos="activePos"
        :depth="0"
        @select="handleHeadingClick"
      />
    </div>
    <div
      v-else
      class="empty-state"
    >
      <p>{{ t('noHeadings') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { parseHeadings } from '@/utils/headings'
import { listToTree } from '@/utils/listToTree'
import type { HeadingItem, HeadingTreeNode } from '@/utils/headings'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { t } from '@/services/i18n'
import { EDITOR } from '@/constants'
import OutlineTreeItem from './OutlineTreeItem.vue'

// ==================== 常量定义 ====================
const SCROLL_THROTTLE_MS = 100
const VIEWPORT_OFFSET_PX = 20
const CACHE_REBUILD_DELAY_MS = 50
const OUTLINE_INIT_DELAY_MS = 200
const MANUAL_CLICK_COOLDOWN_MS = 500

// ==================== 状态管理 ====================
const tabsStore = useTabsStore()
const editorManager = useCrepeEditorManager()

const flatHeadings = ref<HeadingItem[]>([])
const activePos = ref<number | null>(null)
const isManualClick = ref(false)
const isOutlineInitialized = ref(false)

let scrollContainer: HTMLElement | null = null
let scrollHandler: ((event: Event) => void) | null = null
const domPosCache = new Map<HTMLElement, number>()

const activeTab = computed(() => tabsStore.activeTab)

const treeData = computed<HeadingTreeNode[]>(() => {
  if (!flatHeadings.value.length) return []
  return listToTree(flatHeadings.value)
})

// ==================== 核心逻辑 ====================

/**
 * 统一的大纲初始化函数
 * 确保在适当的时机执行所有必要的初始化步骤
 */
function ensureOutlineReady() {
  const tab = activeTab.value
  if (!tab) return

  // 1. 刷新大纲数据
  refreshOutline()

  // 2. 如果需要滚动跟踪，初始化滚动监听
  if (shouldTrackPosition()) {
    // 每次都需要检查是否需要重新初始化
    // 因为标签切换或视图模式切换可能改变了滚动容器
    const currentContainer = findScrollContainer(tab.viewMode)
    
    if (currentContainer !== scrollContainer) {
      // 滚动容器变了，需要重新初始化
      isOutlineInitialized.value = false
    }
    
    if (!isOutlineInitialized.value) {
      initScrollListener()
      isOutlineInitialized.value = true
    } else {
      // 已初始化，只重建缓存
      buildDomPosCache()
    }
  } else {
    // 不需要跟踪，清除状态
    cleanupScrollListener()
    isOutlineInitialized.value = false
  }
}

/**
 * 判断当前大纲是否应该启用定位功能
 */
function shouldTrackPosition(): boolean {
  const tab = activeTab.value
  if (!tab) return false

  const mode = tab.viewMode
  const activeEditor = editorManager.getActiveEditor()

  // 源码模式：不需要定位
  if (mode === EDITOR.VIEW_MODES.SOURCE) return false

  // 分屏模式下，只有当 activeEditor 是 crepe（预览区）时才定位
  if (mode === EDITOR.VIEW_MODES.SPLIT) {
    return activeEditor === 'crepe'
  }

  // WYSIWYG 模式：需要定位
  return true
}

/**
 * 刷新大纲数据
 */
function refreshOutline() {
  const tab = activeTab.value
  if (!tab) {
    flatHeadings.value = []
    return
  }

  // 尝试从 Crepe 获取带 pos 的大纲数据
  if (editorManager.isReady()) {
    flatHeadings.value = editorManager.getHeadingsWithPos()
  } else {
    // 回退到文本解析方式
    flatHeadings.value = parseHeadings(tab.content)
  }

  // 刷新大纲后，重新建立 DOM-pos 缓存
  setTimeout(() => {
    buildDomPosCache()
  }, CACHE_REBUILD_DELAY_MS)
}

/**
 * 初始化滚动监听
 */
function initScrollListener() {
  // 先清理旧的监听器
  cleanupScrollListener()

  const tab = activeTab.value
  if (!tab) {
    return
  }

  const mode = tab.viewMode

  // 只在 WYSIWYG 和分屏模式下需要监听滚动
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG && mode !== EDITOR.VIEW_MODES.SPLIT) {
    return
  }

  // 查找滚动容器
  const editorElement = findScrollContainer(mode)
  if (!editorElement) {
    retryFindScrollContainer(mode)
    return
  }

  scrollContainer = editorElement
  setupScrollHandler()
}

/**
 * 根据模式查找滚动容器
 */
function findScrollContainer(mode: string): HTMLElement | null {
  // WYSIWYG 和分屏模式分别使用不同的选择器
  if (mode === EDITOR.VIEW_MODES.WYSIWYG) {
    return document.querySelector('.editor-wysiwyg') as HTMLElement
  } else if (mode === EDITOR.VIEW_MODES.SPLIT) {
    return document.querySelector('.editor-split-preview') as HTMLElement
  }
  return null
}

/**
 * 重试查找滚动容器
 */
function retryFindScrollContainer(mode: string) {
  let retries = 0
  const maxRetries = 10
  const retryInterval = setInterval(() => {
    retries++

    const editorElement = findScrollContainer(mode)

    if (editorElement) {
      clearInterval(retryInterval)
      scrollContainer = editorElement
      setupScrollHandler()
    } else if (retries >= maxRetries) {
      clearInterval(retryInterval)
      console.error('[DocumentOutline] Failed to find scroll container after', maxRetries, 'retries')
    }
  }, 200)
}

/**
 * 清理滚动监听
 */
function cleanupScrollListener() {
  if (scrollContainer && scrollHandler) {
    scrollContainer.removeEventListener('scroll', scrollHandler)
    scrollContainer = null
    scrollHandler = null
  }
}

/**
 * 设置滚动处理函数
 */
function setupScrollHandler() {
  if (!scrollContainer) {
    return
  }

  let lastUpdateTime = 0
  scrollHandler = () => {
    const now = Date.now()
    // 节流
    if (now - lastUpdateTime < SCROLL_THROTTLE_MS) return
    lastUpdateTime = now

    // 手动点击后短时间内不更新
    if (isManualClick.value) return

    updateActiveHeadingByViewport()
  }

  scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
  buildDomPosCache()
}

/**
 * 建立 DOM 元素到 pos 的映射缓存
 */
function buildDomPosCache() {
  domPosCache.clear()

  if (!scrollContainer || !editorManager.isReady()) return

  const allHeadings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')

  Array.from(allHeadings).forEach((element, index) => {
    const el = element as HTMLElement
    if (index < flatHeadings.value.length) {
      const heading = flatHeadings.value[index]
      if (heading.pos !== undefined) {
        domPosCache.set(el, heading.pos)
      }
    }
  })
}

/**
 * 根据视口位置更新活跃标题（使用索引匹配）
 */
function updateActiveHeadingByViewport() {
  if (!flatHeadings.value.length || !scrollContainer) {
    activePos.value = null
    return
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const viewportTop = containerRect.top + VIEWPORT_OFFSET_PX

  const allHeadings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')

  let nearestIndex = -1
  let minDistance = Infinity

  // 找到距离视口顶部最近的标题元素
  Array.from(allHeadings).forEach((element, index) => {
    const el = element as HTMLElement
    const rect = el.getBoundingClientRect()
    const distance = rect.top - viewportTop

    // 允许标题稍微超出视口顶部
    if (distance >= -50 && distance < minDistance) {
      minDistance = distance
      nearestIndex = index
    }
  })

  // 通过索引匹配 pos
  if (nearestIndex >= 0 && nearestIndex < flatHeadings.value.length) {
    const heading = flatHeadings.value[nearestIndex]
    activePos.value = heading.pos ?? null
  }
}

/**
 * 点击大纲条目 - 滚动到标题
 */
function handleHeadingClick(node: HeadingTreeNode) {
  const tab = activeTab.value
  if (!tab) return

  // 标记为手动点击
  isManualClick.value = true

  // 更新当前激活的标题
  activePos.value = node.pos ?? null

  const mode = tab.viewMode

  if (mode === EDITOR.VIEW_MODES.WYSIWYG || mode === EDITOR.VIEW_MODES.SPLIT) {
    editorManager.scrollToHeading(node.label, node.line, node.pos)
  }

  // 恢复自动跟踪
  setTimeout(() => {
    isManualClick.value = false
  }, MANUAL_CLICK_COOLDOWN_MS)
}

// ==================== 事件监听 ====================

watch(activeTab, () => {
  ensureOutlineReady()
  activePos.value = null
}, { immediate: true })

watch(
  () => activeTab.value?.content,
  () => {
    ensureOutlineReady()
  }
)

let unsubscribeContentChanged: (() => void) | null = null
let unsubscribeTabSwitched: (() => void) | null = null
let unsubscribeEditorReady: (() => void) | null = null
let unsubscribeViewModeChanged: (() => void) | null = null
let unsubscribeActiveEditorChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, () => {
    refreshOutline()
  })

  unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, () => {
    setTimeout(() => {
      ensureOutlineReady()
    }, 100)
  })

  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, () => {
    ensureOutlineReady()
    activePos.value = null
  })

  unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, () => {
    setTimeout(() => {
      ensureOutlineReady()
    }, 100)
  })

  unsubscribeActiveEditorChanged = eventBus.on(AppEvents.ACTIVE_EDITOR_CHANGED, () => {
    setTimeout(() => {
      ensureOutlineReady()
    }, 100)
  })

  // 初始化
  setTimeout(() => {
    ensureOutlineReady()
  }, OUTLINE_INIT_DELAY_MS)
})

onUnmounted(() => {
  unsubscribeContentChanged?.()
  unsubscribeTabSwitched?.()
  unsubscribeEditorReady?.()
  unsubscribeViewModeChanged?.()
  unsubscribeActiveEditorChanged?.()
  cleanupScrollListener()
})
</script>

<style scoped lang="scss">
.document-outline {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.outline-header {
  padding: 12px 16px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.outline-tree {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
    border-radius: 3px;

    &:hover {
      background: var(--scrollbar-thumb-hover);
    }
  }
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  padding: 20px;

  p {
    margin: 0;
    opacity: 0.6;
  }
}
</style>