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
import { listToTree, findNearestHeading } from '@/utils/listToTree'
import type { HeadingItem, HeadingTreeNode } from '@/utils/headings'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { t } from '@/services/i18n'
import { EDITOR } from '@/constants'
import OutlineTreeItem from './OutlineTreeItem.vue'

const tabsStore = useTabsStore()
const editorManager = useCrepeEditorManager()

const flatHeadings = ref<HeadingItem[]>([])
const activePos = ref<number | null>(null)  // 使用 pos 作为唯一标识
const cursorLine = ref(0)
const isManualClick = ref(false) // 标记是否是手动点击
let scrollContainer: HTMLElement | null = null
let scrollHandler: ((event: Event) => void) | null = null

/**
 * 建立 DOM 元素到 pos 的映射缓存
 * 用于在滚动时快速查找标题对应的 pos
 */
const domPosCache = new Map<HTMLElement, number>()

const activeTab = computed(() => tabsStore.activeTab)

const treeData = computed<HeadingTreeNode[]>(() => {
  // 当没有内容或没有标题时返回空数组
  if (!flatHeadings.value.length) return []
  return listToTree(flatHeadings.value)
})

/**
 * 判断当前大纲是否应该启用定位功能
 * 源码模式和分屏源码区不需要定位
 */
function shouldTrackPosition(): boolean {
  const tab = activeTab.value
  if (!tab) return false
  const mode = tab.viewMode
  // 源码模式：不需要定位
  if (mode === EDITOR.VIEW_MODES.SOURCE) return false
  // 分屏模式下，只有当 activeEditor 是 crepe（即用户在预览区）时才定位
  if (mode === EDITOR.VIEW_MODES.SPLIT) {
    return editorManager.getActiveEditor() === 'crepe'
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
  }, 50)
}

/**
 * 更新当前活跃的标题
 */
function updateActiveHeading() {
  // 如果是手动点击后的短时间内，不自动更新
  if (isManualClick.value) return
  
  if (!shouldTrackPosition() || cursorLine.value <= 0) {
    activePos.value = null
    return
  }

  const nearest = findNearestHeading(flatHeadings.value, cursorLine.value)
  activePos.value = nearest?.pos ?? null
}

/**
 * 初始化滚动监听
 * 
 * 在 WYSIWYG 和分屏模式下，监听编辑器的滚动事件，
 * 实现大纲高亮跟随编辑器滚动位置实时更新。
 */
function initScrollListener() {
  // 先移除旧的监听器，避免重复绑定
  if (scrollContainer && scrollHandler) {
    scrollContainer.removeEventListener('scroll', scrollHandler)
    scrollContainer = null
  }

  const tab = activeTab.value
  if (!tab) {
    console.debug('[DocumentOutline] initScrollListener: no active tab')
    return
  }

  const mode = tab.viewMode
  console.debug('[DocumentOutline] initScrollListener: tab.viewMode =', mode)
  
  // 只在 WYSIWYG 和分屏模式下需要监听滚动
  // 源码模式不需要滚动同步
  if (mode !== EDITOR.VIEW_MODES.WYSIWYG && mode !== EDITOR.VIEW_MODES.SPLIT) {
    console.debug('[DocumentOutline] initScrollListener: mode not wysiwyg or split')
    return
  }

  // 找到 Crepe 编辑器的滚动容器
  // WYSIWYG 模式：.crepe.editor-wysiwyg
  // 分屏模式：.crepe.editor-split-preview（预览区域）
  let editorElement: HTMLElement | null = null
  
  console.debug('[DocumentOutline] initScrollListener for mode:', mode)
  
  if (mode === EDITOR.VIEW_MODES.WYSIWYG) {
    // 先查找 .crepe.editor-wysiwyg
    editorElement = document.querySelector('.crepe.editor-wysiwyg') as HTMLElement
    console.debug('[DocumentOutline] WYSIWYG: looking for .crepe.editor-wysiwyg, found:', !!editorElement)
    
    // 如果没找到，尝试查找滚动容器
    if (!editorElement) {
      // 尝试查找 .editor-content.mode-wysiwyg，它才是真正的滚动容器（有 overflow-y: auto）
      editorElement = document.querySelector('.editor-content.mode-wysiwyg') as HTMLElement
      console.debug('[DocumentOutline] WYSIWYG: looking for .editor-content.mode-wysiwyg, found:', !!editorElement)
    }
    
    // 如果还是没找到，尝试只找 .crepe
    if (!editorElement) {
      const allCrepe = document.querySelectorAll('.crepe')
      console.debug('[DocumentOutline] WYSIWYG: found', allCrepe.length, 'crepe elements')
      
      // 查找有 .editor-wysiwyg 类的元素
      for (const el of Array.from(allCrepe)) {
        if ((el as HTMLElement).classList.contains('editor-wysiwyg')) {
          editorElement = el as HTMLElement
          console.debug('[DocumentOutline] WYSIWYG: found editor-wysiwyg in crepe elements')
          break
        }
      }
    }
  } else if (mode === EDITOR.VIEW_MODES.SPLIT) {
    // 分屏模式下，优先使用 activeEditor，如果为 null 则默认监听预览区
    const activeEditor = editorManager.getActiveEditor()
    
    // 如果 activeEditor 是 crepe 或 null（未设置），都监听预览区
    if (activeEditor === 'crepe' || activeEditor === null) {
      editorElement = document.querySelector('.crepe.editor-split-preview') as HTMLElement
      console.debug('[DocumentOutline] SPLIT: looking for .crepe.editor-split-preview, found:', !!editorElement)
    }
    // 如果 activeEditor 是 codemirror，不监听（用户在源码区编辑）
  }
  
  if (!editorElement) {
    console.warn('[DocumentOutline] Scroll container not found for mode:', mode, ', will retry...')
    
    // 延迟重试，最多重试 10 次
    let retries = 0
    const maxRetries = 10
    const retryInterval = setInterval(() => {
      retries++
      
      if (mode === EDITOR.VIEW_MODES.WYSIWYG) {
        editorElement = document.querySelector('.crepe.editor-wysiwyg') as HTMLElement
      } else if (mode === EDITOR.VIEW_MODES.SPLIT) {
        const activeEditor = editorManager.getActiveEditor()
        // 如果 activeEditor 是 crepe 或 null，都尝试查找预览区
        if (activeEditor === 'crepe' || activeEditor === null) {
          editorElement = document.querySelector('.crepe.editor-split-preview') as HTMLElement
        }
      }
      
      if (editorElement || retries >= maxRetries) {
        clearInterval(retryInterval)
        
        if (editorElement) {
          console.debug('[DocumentOutline] Retry succeeded, found scroll container')
          scrollContainer = editorElement
          setupScrollHandler()
        } else {
          console.error('[DocumentOutline] Failed to find scroll container after', maxRetries, 'retries')
        }
      }
    }, 200)
    return
  }

  scrollContainer = editorElement
  console.debug('[DocumentOutline] Scroll container found, setting up handler')
  setupScrollHandler()
}

/**
 * 设置滚动处理函数
 */
function setupScrollHandler() {
  if (!scrollContainer) {
    console.error('[DocumentOutline] setupScrollHandler: no scroll container')
    return
  }
  
  console.debug('[DocumentOutline] setupScrollHandler called')
  
  // 创建节流版本的滚动处理函数（100ms）
  // 避免频繁更新影响性能
  let lastUpdateTime = 0
  scrollHandler = () => {
    const now = Date.now()
    // 节流：至少间隔 100ms 才更新一次
    if (now - lastUpdateTime < 100) return
    lastUpdateTime = now

    // 如果是手动点击后的短时间内，不自动更新
    // 避免与用户操作冲突
    if (isManualClick.value) {
      console.debug('[DocumentOutline] Skipping update - isManualClick')
      return
    }

    // 根据视口位置更新活跃标题
    updateActiveHeadingByViewport()
  }

  // 添加滚动监听，使用 passive 优化性能
  scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
  console.debug('[DocumentOutline] Scroll listener added')
  
  // 滚动容器建立后，建立 DOM-pos 缓存
  buildDomPosCache()
}

function buildDomPosCache() {
  domPosCache.clear()
  
  if (!scrollContainer || !editorManager.isReady()) {
    console.debug('[DocumentOutline] buildDomPosCache skipped - not ready')
    return
  }
  
  const allHeadings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
  console.debug('[DocumentOutline] Found', allHeadings.length, 'headings in DOM')
  
  // 由于 DOM 顺序和 flatHeadings 顺序一致，我们可以按索引匹配
  Array.from(allHeadings).forEach((element, index) => {
    const el = element as HTMLElement
    if (index < flatHeadings.value.length) {
      const heading = flatHeadings.value[index]
      if (heading.pos !== undefined) {
        domPosCache.set(el, heading.pos)
      }
    }
  })
  
  console.debug('[DocumentOutline] domPosCache built:', domPosCache.size, 'headings')
}

/**
 * 根据视口位置更新活跃标题
 * 
 * 核心逻辑：
 * 1. 通过滚动容器找到视口中的标题元素
 * 2. 使用 DOM 顺序和 flatHeadings 顺序匹配
 */
function updateActiveHeadingByViewport() {
  console.debug('[DocumentOutline] updateActiveHeadingByViewport called')
  
  if (!flatHeadings.value.length || !scrollContainer) {
    console.debug('[DocumentOutline] No headings or no scroll container')
    activePos.value = null
    return
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const viewportTop = containerRect.top + 20 // 留 20px 边距，让标题不紧贴顶部

  // 步骤 1: 直接遍历 DOM 中的所有标题元素
  const allHeadings = scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')
  
  console.debug('[DocumentOutline] Found', allHeadings.length, 'headings in DOM,', flatHeadings.value.length, 'in flatHeadings')
  
  let nearestElement: HTMLElement | null = null
  let nearestIndex = -1
  let minDistance = Infinity

  // 步骤 2: 找到距离视口顶部最近的标题元素
  Array.from(allHeadings).forEach((element, index) => {
    const el = element as HTMLElement
    const rect = el.getBoundingClientRect()
    const distance = rect.top - viewportTop

    // 找到距离视口顶部最近且在视口内的标题
    // distance >= -50 允许标题稍微超出视口顶部
    if (distance >= -50 && distance < minDistance) {
      minDistance = distance
      nearestElement = el
      nearestIndex = index
    }
  })

  // 步骤 3: 将找到的 DOM 元素匹配到 flatHeadings 中的 pos
  let matchedPos: number | null = null
  let matchStrategy = 'none'
  
  if (nearestElement && nearestIndex >= 0) {
    const el = nearestElement as HTMLElement
    const nearestText = el.textContent?.trim() || ''
    
    // 策略 1: 优先通过索引匹配 (最可靠)
    if (nearestIndex < flatHeadings.value.length) {
      const heading = flatHeadings.value[nearestIndex]
      // 验证一下文本是否一致
      if (heading.text === nearestText) {
        matchedPos = heading.pos ?? null
        matchStrategy = 'index'
      }
    }
    
    // 策略 2: 如果索引匹配失败，使用缓存
    if (matchedPos === null && domPosCache.has(el)) {
      const cachedPos = domPosCache.get(el)!
      const heading = flatHeadings.value.find(h => h.pos === cachedPos)
      if (heading) {
        matchedPos = cachedPos
        matchStrategy = 'cache'
      }
    }
    
    // 策略 3: 回退到文本内容和层级匹配
    if (matchedPos === null) {
      const elementText = el.textContent?.trim() || ''
      const elementTag = el.tagName.toLowerCase()
      const elementLevel = parseInt(elementTag.substring(1)) || 1
      
      const candidates = flatHeadings.value.filter(h => 
        h.text === elementText && h.level === elementLevel
      )
      
      if (candidates.length === 1) {
        matchedPos = candidates[0].pos ?? null
        matchStrategy = 'text-single'
      } else if (candidates.length > 1) {
        matchedPos = candidates[0].pos ?? null
        matchStrategy = `text-multi(${candidates.length})`
      }
    }
    
    console.debug('[DocumentOutline] Scroll match:', {
      element: el.textContent?.trim(),
      nearestIndex,
      strategy: matchStrategy,
      matchedPos,
      minDistance
    })
  }

  activePos.value = matchedPos
}

/**
 * 点击大纲条目 - 滚动到标题
 */
function handleHeadingClick(node: HeadingTreeNode) {
  const tab = activeTab.value
  if (!tab) return

  // 标记为手动点击，暂时禁用自动跟踪
  isManualClick.value = true
  
  // 更新当前激活的标题（使用 pos 作为唯一标识）
  activePos.value = node.pos ?? null

  const mode = tab.viewMode

  if (mode === EDITOR.VIEW_MODES.WYSIWYG || mode === EDITOR.VIEW_MODES.SPLIT) {
    // WYSIWYG 或分屏预览模式：使用 Crepe 的 ProseMirror API 滚动
    // 传递 pos 参数以实现精确定位
    editorManager.scrollToHeading(node.label, node.line, node.pos)
  }
  // 源码模式和分屏源码区：不需要大纲定位
  
  // 500ms 后恢复自动跟踪
  setTimeout(() => {
    isManualClick.value = false
  }, 500)
}

// 监听标签切换
watch(activeTab, () => {
  refreshOutline()
  activePos.value = null
  cursorLine.value = 0
}, { immediate: true })

// 监听内容变化
watch(
  () => activeTab.value?.content,
  () => {
    refreshOutline()
  }
)

let unsubscribeContentChanged: (() => void) | null = null
let unsubscribeTabSwitched: (() => void) | null = null
let unsubscribeCursorChanged: (() => void) | null = null
let unsubscribeEditorReady: (() => void) | null = null
let unsubscribeViewModeChanged: (() => void) | null = null

onMounted(() => {
  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, () => {
    refreshOutline()
  })

  // 监听编辑器就绪事件，重新生成带 pos 的大纲，并初始化滚动监听
  unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, () => {
    // Crepe 就绪后，重新生成大纲以获取 pos
    setTimeout(() => {
      refreshOutline()
      initScrollListener()
    }, 100)
  })

  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, () => {
    refreshOutline()
    activePos.value = null
    cursorLine.value = 0
    // 标签切换后重新初始化滚动监听
    setTimeout(() => {
      initScrollListener()
    }, 100)
  })

// 监听光标变化
  unsubscribeCursorChanged = eventBus.on(AppEvents.CURSOR_CHANGED, (payload) => {
    const data = payload as { from: number; to: number; tabId: string }
    if (data.tabId === activeTab.value?.id) {
      const mode = activeTab.value?.viewMode
      const activeEditor = editorManager.getActiveEditor()

      // WYSIWYG 模式：使用 Crepe API 获取光标行号
      if (mode === EDITOR.VIEW_MODES.WYSIWYG) {
        cursorLine.value = editorManager.getCurrentCursorLine()
        updateActiveHeading()
        return
      }

      // 分屏模式：仅当 activeEditor 为 crepe（预览区）时才跟踪
      if (mode === EDITOR.VIEW_MODES.SPLIT && activeEditor === 'crepe') {
        cursorLine.value = editorManager.getCurrentCursorLine()
        updateActiveHeading()
        return
      }

      // 其他情况（源码模式、分屏源码区）：不更新大纲定位
      cursorLine.value = 0
      activePos.value = null
    }
  })

  // 初始化滚动监听（延迟执行，确保 DOM 已渲染）
  setTimeout(() => {
    initScrollListener()
  }, 200)

  // 监听视图模式切换，重新初始化滚动监听
  unsubscribeViewModeChanged = eventBus.on(AppEvents.VIEW_MODE_CHANGED, () => {
    // 视图模式切换后重新初始化滚动监听
    setTimeout(() => {
      initScrollListener()
    }, 100)
  })
})

onUnmounted(() => {
  unsubscribeContentChanged?.()
  unsubscribeTabSwitched?.()
  unsubscribeCursorChanged?.()
  unsubscribeEditorReady?.()
  unsubscribeViewModeChanged?.()
  
  // 清理滚动监听
  if (scrollContainer && scrollHandler) {
    scrollContainer.removeEventListener('scroll', scrollHandler)
    scrollContainer = null
    scrollHandler = null
  }
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