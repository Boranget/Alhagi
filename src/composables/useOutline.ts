import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { eventBus, AppEvents } from '@/events/eventBus'
import { parseHeadings } from '@/utils/headings'
import { listToTree } from '@/utils/listToTree'
import { useCrepeEditorManager } from '@/managers/crepeEditorManager'
import { EDITOR } from '@/constants'
import type { HeadingItem, HeadingTreeNode } from '@/utils/headings'

const SCROLL_THROTTLE_MS = 100
const VIEWPORT_OFFSET_PX = 20
const CACHE_REBUILD_DELAY_MS = 50
const MANUAL_CLICK_COOLDOWN_MS = 500

export function useOutline() {
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

  function shouldTrackPosition(): boolean {
    const tab = activeTab.value
    if (!tab) return false

    const mode = tab.viewMode
    const activeEditor = editorManager.getActiveEditor()

    if (mode === EDITOR.VIEW_MODES.SOURCE) return false

    if (mode === EDITOR.VIEW_MODES.SPLIT) {
      return activeEditor === 'crepe'
    }

    return true
  }

  function refreshOutline() {
    const tab = activeTab.value
    if (!tab) {
      flatHeadings.value = []
      return
    }

    if (editorManager.isReady()) {
      flatHeadings.value = editorManager.getHeadingsWithPos()
    } else {
      flatHeadings.value = parseHeadings(tab.content)
    }

    setTimeout(() => {
      buildDomPosCache()
    }, CACHE_REBUILD_DELAY_MS)
  }

  function initScrollListener() {
    cleanupScrollListener()

    const tab = activeTab.value
    if (!tab) return

    const mode = tab.viewMode
    if (mode !== EDITOR.VIEW_MODES.WYSIWYG && mode !== EDITOR.VIEW_MODES.SPLIT) {
      return
    }

    const editorElement = findScrollContainer(mode)
    if (!editorElement) {
      retryFindScrollContainer(mode)
      return
    }

    scrollContainer = editorElement
    setupScrollHandler()
  }

  function findScrollContainer(mode: string): HTMLElement | null {
    if (mode === EDITOR.VIEW_MODES.WYSIWYG) {
      return document.querySelector('.editor-wysiwyg') as HTMLElement
    } else if (mode === EDITOR.VIEW_MODES.SPLIT) {
      return document.querySelector('.editor-split-preview') as HTMLElement
    }
    return null
  }

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
      }
    }, 200)
  }

  function cleanupScrollListener() {
    if (scrollContainer && scrollHandler) {
      scrollContainer.removeEventListener('scroll', scrollHandler)
      scrollContainer = null
      scrollHandler = null
    }
  }

  function setupScrollHandler() {
    if (!scrollContainer) return

    let lastUpdateTime = 0
    scrollHandler = () => {
      const now = Date.now()
      if (now - lastUpdateTime < SCROLL_THROTTLE_MS) return
      lastUpdateTime = now

      if (isManualClick.value) return

      updateActiveHeadingByViewport()
    }

    scrollContainer.addEventListener('scroll', scrollHandler, { passive: true })
    buildDomPosCache()
  }

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

    Array.from(allHeadings).forEach((element, index) => {
      const el = element as HTMLElement
      const rect = el.getBoundingClientRect()
      const distance = rect.top - viewportTop

      if (distance >= -50 && distance < minDistance) {
        minDistance = distance
        nearestIndex = index
      }
    })

    if (nearestIndex >= 0 && nearestIndex < flatHeadings.value.length) {
      const heading = flatHeadings.value[nearestIndex]
      activePos.value = heading.pos ?? null
    }
  }

  function handleHeadingClick(node: HeadingTreeNode) {
    const tab = activeTab.value
    if (!tab) return

    isManualClick.value = true
    activePos.value = node.pos ?? null

    const mode = tab.viewMode

    if (mode === EDITOR.VIEW_MODES.WYSIWYG || mode === EDITOR.VIEW_MODES.SPLIT) {
      editorManager.scrollToHeading(node.label, node.line, node.pos)
    }

    setTimeout(() => {
      isManualClick.value = false
    }, MANUAL_CLICK_COOLDOWN_MS)
  }

  function ensureOutlineReady() {
    const tab = activeTab.value
    if (!tab) return

    refreshOutline()

    if (shouldTrackPosition()) {
      const currentContainer = findScrollContainer(tab.viewMode)

      if (currentContainer !== scrollContainer) {
        isOutlineInitialized.value = false
      }

      if (!isOutlineInitialized.value) {
        initScrollListener()
        isOutlineInitialized.value = true
      } else {
        buildDomPosCache()
      }
    } else {
      cleanupScrollListener()
      isOutlineInitialized.value = false
    }
  }

  let unsubscribeContentChanged: (() => void) | null = null
  let unsubscribeTabSwitched: (() => void) | null = null
  let unsubscribeEditorReady: (() => void) | null = null
  let unsubscribeViewModeChanged: (() => void) | null = null
  let unsubscribeActiveEditorChanged: (() => void) | null = null

  function setupEventListeners() {
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
  }

  function cleanupEventListeners() {
    unsubscribeContentChanged?.()
    unsubscribeTabSwitched?.()
    unsubscribeEditorReady?.()
    unsubscribeViewModeChanged?.()
    unsubscribeActiveEditorChanged?.()
    cleanupScrollListener()
  }

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

  onMounted(() => {
    setupEventListeners()
    setTimeout(() => {
      ensureOutlineReady()
    }, 200)
  })

  onUnmounted(() => {
    cleanupEventListeners()
  })

  return {
    headings: treeData,
    activePos,
    handleHeadingClick,
    refreshOutline,
    ensureOutlineReady
  }
}