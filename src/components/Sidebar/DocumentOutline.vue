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

onMounted(() => {
  unsubscribeContentChanged = eventBus.on(AppEvents.CONTENT_CHANGED, () => {
    refreshOutline()
  })

  // 监听编辑器就绪事件，重新生成带 pos 的大纲
  unsubscribeEditorReady = eventBus.on(AppEvents.EDITOR_READY, () => {
    // Crepe 就绪后，重新生成大纲以获取 pos
    setTimeout(() => {
      refreshOutline()
    }, 100)
  })

  unsubscribeTabSwitched = eventBus.on(AppEvents.TAB_SWITCHED, () => {
    refreshOutline()
    activePos.value = null
    cursorLine.value = 0
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
      activeSlug.value = null
    }
  })
})

onUnmounted(() => {
  unsubscribeContentChanged?.()
  unsubscribeTabSwitched?.()
  unsubscribeCursorChanged?.()
  unsubscribeEditorReady?.()
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