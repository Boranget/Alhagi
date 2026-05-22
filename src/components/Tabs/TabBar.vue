<template>
  <div class="tab-bar" @dragover.prevent="handleTabBarDragOver($event)">
    <div class="tabs-container">
      <div
        v-for="tabId in tabsStore.tabOrder"
        :key="tabId"
        class="tab-item"
        :class="{ 
          active: tabId === tabsStore.activeTabId, 
          dirty: getTab(tabId)?.isDirty, 
          dragging: dragState.sourceTabId === tabId,
          'drag-over': dragState.targetTabId === tabId
        }"
        draggable="true"
        @click="handleTabClick(tabId)"
        @contextmenu.prevent="showContextMenu($event, tabId)"
        @mousedown.middle="handleTabClose(tabId)"
        @dragstart="handleDragStart($event, tabId)"
        @dragend="handleDragEnd($event)"
        @dragover.prevent="handleDragOver($event, tabId)"
        @dragenter.prevent="handleDragEnter($event, tabId)"
        @dragleave="handleDragLeave($event)"
        @drop="handleDrop($event, tabId)"
      >
        <span class="tab-title">{{ getTab(tabId)?.title || t('tabs.untitled') }}</span>
        <button
          class="tab-close"
          @click.stop="handleTabClose(tabId)"
        >
          <span
            v-if="getTab(tabId)?.isDirty"
            class="dirty-indicator"
          >●</span>
          <Icon 
            v-else 
            name="close" 
            size="sm" 
          />
        </button>
      </div>
    </div>
    <div class="tab-actions">
      <button
        class="new-tab-btn"
        @click="handleNewTab"
      >
        <Icon
          name="plus"
          size="sm"
        />
      </button>
    </div>

    <div
      v-if="contextMenu.show"
      class="tab-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <div
        class="menu-item"
        @click="saveCurrentTab"
      >
        <Icon
          name="save"
          size="sm"
        />
        <span class="menu-text">{{ t('common.save') }}</span>
      </div>
      <div
        class="menu-item"
        @click="saveAsCurrentTab"
      >
        <Icon
          name="save"
          size="sm"
        />
        <span class="menu-text">{{ t('common.saveAs') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="closeCurrentTab"
      >
        <Icon
          name="close"
          size="sm"
        />
        <span class="menu-text">{{ t('common.close') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeOtherTabs"
      >
        <Icon
          name="list"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeOtherTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeSavedTabs"
      >
        <Icon
          name="folder"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeSavedTabs') }}</span>
      </div>
      <div
        class="menu-item"
        @click="closeAllTabs"
      >
        <Icon
          name="trash"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.closeAllTabs') }}</span>
      </div>
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-divider"
      />
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-item"
        @click="copyFilePath"
      >
        <Icon
          name="copy"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.copyPath') }}</span>
      </div>
      <div
        v-if="getCurrentTab()?.filePath"
        class="menu-item"
        @click="showInFolder"
      >
        <Icon
          name="folder-open"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.showInFolder') }}</span>
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="detachTab"
      >
        <Icon
          name="maximize"
          size="sm"
        />
        <span class="menu-text">{{ t('tabs.detachToNewWindow') }}</span>
      </div>
    </div>
    
    <Teleport to="body">
      <div
        v-if="dragState.sourceTabId"
        class="tab-drag-ghost"
        :style="ghostStyle"
      >
        <span>{{ getTab(dragState.sourceTabId)?.title || t('tabs.untitled') }}</span>
      </div>
    </Teleport>
    
    <Teleport to="body">
      <div
        v-if="dragState.targetType === 'windowEdge' && windowList.length > 1"
        class="window-edge-indicator"
        :class="dragState.windowEdgeDirection"
      >
        <Icon 
          :name="dragState.windowEdgeDirection === 'left' ? 'chevron-left' : 'chevron-right'" 
          size="lg" 
        />
        <div class="edge-text">
          {{ t('tabs.releaseToMerge') }}
        </div>
      </div>
    </Teleport>
    
    <Teleport to="body">
      <div
        v-if="dragState.targetType === 'outsideWindow'"
        class="outside-window-indicator"
      >
        <Icon 
          name="maximize" 
          size="lg" 
        />
        <div class="outside-text">
          {{ t('tabs.releaseToNewWindow') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { t } from '@/services/i18n'
import type { TabState } from '@/types'
import { Icon } from '@/components/Icons'

type DragTargetType = 'none' | 'tab' | 'windowEdge' | 'outsideWindow'

interface DragState {
  sourceTabId: string | null
  targetType: DragTargetType
  targetTabId: string | null
  targetWindowId: number | null
  windowEdgeDirection: 'left' | 'right' | null
  insertIndex: number
  mousePosition: { x: number, y: number }
}

const tabsStore = useTabsStore()

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tabId: null as string | null
})

const dragState = reactive<DragState>({
  sourceTabId: null,
  targetType: 'none',
  targetTabId: null,
  targetWindowId: null,
  windowEdgeDirection: null,
  insertIndex: -1,
  mousePosition: { x: 0, y: 0 }
})

interface WindowInfo {
  id: number
  title: string
  bounds: { x: number; y: number; width: number; height: number }
}

const windowList = ref<WindowInfo[]>([])
let currentWindowId: number | null = null
let dragLeaveTimer: ReturnType<typeof setTimeout> | null = null
let hasDroppedOnTab = false

const ghostStyle = computed(() => ({
  left: `${dragState.mousePosition.x}px`,
  top: `${dragState.mousePosition.y}px`
}))

function getTab(tabId: string): TabState | undefined {
  return tabsStore.tabs.get(tabId)
}

/**
 * 将 Pinia 响应式 TabState 转为纯对象，避免 IPC structured clone 报错。
 * Pinia 的 reactive proxy 内部携带 __v_isReactive 等标记，无法被 serialized clone。
 */
function serializeTabForIPC(tab: TabState) {
  return JSON.parse(JSON.stringify({
    id: tab.id,
    title: tab.title,
    content: tab.content,
    filePath: tab.filePath ?? null,
    isDirty: tab.isDirty,
    viewMode: tab.viewMode,
    cursor: tab.cursor ?? { from: 0, to: 0 },
    scrollTop: tab.scrollTop ?? 0
  }))
}

function getCurrentTab(): TabState | undefined {
  if (contextMenu.value.tabId) {
    return getTab(contextMenu.value.tabId)
  }
  return undefined
}

function resetDragState() {
  dragState.sourceTabId = null
  dragState.targetType = 'none'
  dragState.targetTabId = null
  dragState.targetWindowId = null
  dragState.windowEdgeDirection = null
  dragState.insertIndex = -1
  hasDroppedOnTab = false
}

async function refreshWindowList() {
  if (window.electronAPI) {
    try {
      const idResp = await window.electronAPI.getWindowId()
      if (idResp.success && idResp.data) {
        currentWindowId = idResp.data
      }
      const listResp = await window.electronAPI.listWindows()
      if (listResp.success && listResp.data) {
        windowList.value = listResp.data
      }
    } catch (e) {
      console.error('Failed to get window info:', e)
    }
  }
}

function handleTabClick(tabId: string) {
  tabsStore.switchTab(tabId)
  hideContextMenu()
}

function showContextMenu(event: MouseEvent, tabId: string) {
  tabsStore.switchTab(tabId)

  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    tabId
  }
}

function hideContextMenu() {
  contextMenu.value.show = false
  contextMenu.value.tabId = null
}

function handleGlobalKeydown() {
  // 暂时不需要全局键盘事件处理
}

function handleGlobalClick() {
  hideContextMenu()
}

function handleTabClose(tabId: string) {
  const tab = getTab(tabId)
  if (tab?.isDirty) {
    if (!confirm('文件有未保存的更改，确定要关闭吗？')) {
      return
    }
  }
  tabsStore.removeTab(tabId)
}

function handleNewTab() {
  tabsStore.createTab()
}

function saveCurrentTab() {
  if (contextMenu.value.tabId) {
    tabsStore.saveFile(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function saveAsCurrentTab() {
  if (contextMenu.value.tabId) {
    tabsStore.saveFileAs(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function closeCurrentTab() {
  if (contextMenu.value.tabId) {
    handleTabClose(contextMenu.value.tabId)
  }
  hideContextMenu()
}

function closeOtherTabs() {
  const activeTabId = tabsStore.activeTabId
  const allTabIds = Array.from(tabsStore.tabs.keys())

  for (const tabId of allTabIds) {
    if (tabId !== activeTabId) {
      const tab = getTab(tabId)
      if (tab?.isDirty) {
        if (!confirm(`文件 "${tab.title}" 有未保存的更改，确定要关闭吗？`)) {
          continue
        }
      }
      tabsStore.removeTab(tabId)
    }
  }
  hideContextMenu()
}

function closeSavedTabs() {
  const allTabIds = Array.from(tabsStore.tabs.keys())

  for (const tabId of allTabIds) {
    const tab = getTab(tabId)
    if (!tab?.isDirty && tabsStore.tabCount > 1) {
      tabsStore.removeTab(tabId)
    }
  }
  hideContextMenu()
}

function closeAllTabs() {
  const allTabIds = Array.from(tabsStore.tabs.keys())
  let hasDirtyTab = false

  for (const tabId of allTabIds) {
    const tab = getTab(tabId)
    if (tab?.isDirty) {
      hasDirtyTab = true
      break
    }
  }

  if (hasDirtyTab) {
    if (!confirm('有些文件有未保存的更改，确定要关闭全部吗？')) {
      hideContextMenu()
      return
    }
  }

  for (const tabId of allTabIds) {
    tabsStore.removeTab(tabId)
  }
  
  hideContextMenu()
}

function copyFilePath() {
  const tab = getCurrentTab()
  if (tab?.filePath) {
    navigator.clipboard.writeText(tab.filePath)
  }
  hideContextMenu()
}

async function showInFolder() {
  const tab = getCurrentTab()
  if (tab?.filePath && window.electronAPI) {
    try {
      await window.electronAPI.showInFolder(tab.filePath)
    } catch (error) {
      console.error('Failed to show in folder:', error)
    }
  }
  hideContextMenu()
}

async function handleDragStart(event: DragEvent, tabId: string) {
  dragState.sourceTabId = tabId
  dragState.targetType = 'none'
  dragState.targetTabId = null
  dragState.targetWindowId = null
  dragState.windowEdgeDirection = null
  hasDroppedOnTab = false
  
  await refreshWindowList()
  
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', tabId)
    
    setTimeout(() => {
      if (dragState.sourceTabId === tabId) {
        dragState.mousePosition = {
          x: event.clientX,
          y: event.clientY
        }
      }
    }, 0)
  }
}

function updateWindowEdgeState(event: DragEvent) {
  if (!dragState.sourceTabId) return
  
  const edgeThreshold = 50
  const direction: 'left' | 'right' | null = 
    event.clientX < edgeThreshold ? 'left' : 
    event.clientX > window.innerWidth - edgeThreshold ? 'right' : null
  
  if (direction) {
    const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
    if (otherWindows.length > 0) {
      // 用屏幕坐标选择最近的目标窗口
      const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
      const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY
      const bestWindow = findWindowAtPoint(otherWindows, screenX, screenY) ?? otherWindows[0]
      
      dragState.targetType = 'windowEdge'
      dragState.windowEdgeDirection = direction
      dragState.targetWindowId = bestWindow.id
      dragState.targetTabId = null
      return
    }
  }
  
  dragState.targetType = 'none'
  dragState.windowEdgeDirection = null
  dragState.targetWindowId = null
  dragState.targetTabId = null
}

/**
 * 在窗口列表中查找包含指定屏幕坐标的窗口。
 * 优先精确命中，其次按距离排序（选最近的）。
 */
function findWindowAtPoint(
  winList: WindowInfo[],
  screenX: number,
  screenY: number
): WindowInfo | null {
  let closest: WindowInfo | null = null
  let closestDist = Infinity

  for (const w of winList) {
    const { x, y, width, height } = w.bounds
    if (screenX >= x && screenX <= x + width && screenY >= y && screenY <= y + height) {
      return w // 精确命中
    }
    // 计算到窗口中心的距离
    const cx = x + width / 2
    const cy = y + height / 2
    const dist = Math.sqrt((screenX - cx) ** 2 + (screenY - cy) ** 2)
    if (dist < closestDist) {
      closestDist = dist
      closest = w
    }
  }
  return closest
}

function isMouseOutsideWindow(event: DragEvent): boolean {
  return (
    event.clientX < 0 ||
    event.clientX > window.innerWidth ||
    event.clientY < 0 ||
    event.clientY > window.innerHeight
  )
}

/**
 * 标签栏全局 dragover —— 处理鼠标在标签栏空白区域（非 tab 上）时的边缘检测。
 * 当鼠标在具体 tab 上方时，由该 tab 的 handleDragOver 负责。
 */
function handleTabBarDragOver(event: DragEvent) {
  if (!dragState.sourceTabId) return
  
  dragState.mousePosition = { x: event.clientX, y: event.clientY }
  
  // 检查鼠标实际是否在某个 tab 元素上方 → 交给 tab 级 handler
  const elUnderMouse = document.elementFromPoint(event.clientX, event.clientY)
  if (elUnderMouse?.closest('.tab-item')) return
  
  // 不在任何 tab 上 → 清理 tab 相关状态
  dragState.targetTabId = null
  
  if (isMouseOutsideWindow(event)) {
    dragState.targetType = 'outsideWindow'
    dragState.targetTabId = null
    dragState.windowEdgeDirection = null
    dragState.targetWindowId = null
    return
  }
  
  updateWindowEdgeState(event)
}

/**
 * dragenter 只做一件事：取消 dragleave 的兜底 timer。
 * 状态（targetType/targetTabId）由紧随其后触发的 handleDragOver 统一管理，
 * 避免 dragenter 和 dragover 各自修改状态造成覆盖/冲突。
 */
function handleDragEnter(_event: DragEvent, tabId: string) {
  if (!dragState.sourceTabId || dragState.sourceTabId === tabId) return
  
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
    dragLeaveTimer = null
  }
}

function handleDragOver(event: DragEvent, tabId: string) {
  if (!dragState.sourceTabId) return
  
  dragState.mousePosition = { x: event.clientX, y: event.clientY }
  
  // 不响应源 tab 自身的 dragover
  if (dragState.sourceTabId === tabId) return
  
  if (isMouseOutsideWindow(event)) {
    dragState.targetType = 'outsideWindow'
    dragState.targetTabId = null
    dragState.windowEdgeDirection = null
    dragState.targetWindowId = null
    return
  }
  
  updateWindowEdgeState(event)
  
  // updateWindowEdgeState 可能将 targetType 设为 'windowEdge' 或 'none'
  // 只要不是 windowEdge，鼠标就在某个 tab 上 → 设置为 tab
  if (dragState.targetType !== 'windowEdge') {
    dragState.targetTabId = tabId
    dragState.targetType = 'tab'
  }
}

function handleDragLeave(_event: DragEvent) {
  // handleDragOver / handleTabBarDragOver 每次都会重新计算 targetType。
  // dragleave 不需要立即清理 —— 如果鼠标确实离开了所有 tab，
  // handleTabBarDragOver 里的 elementFromPoint 检测会接管并清理。
  // 这里只做延迟兜底清理，防止某些边缘情况下状态残留。
  if (!dragState.sourceTabId) return
  
  if (dragLeaveTimer) clearTimeout(dragLeaveTimer)
  dragLeaveTimer = setTimeout(() => {
    if (dragState.targetType === 'tab') {
      dragState.targetTabId = null
      dragState.targetType = 'none'
    }
  }, 100)
}

function handleDrop(event: DragEvent, targetTabId: string) {
  event.preventDefault()
  
  if (!dragState.sourceTabId || dragState.sourceTabId === targetTabId) return
  if (dragState.targetType !== 'tab') return
  
  hasDroppedOnTab = true
  
  const currentOrder = [...tabsStore.tabOrder]
  const fromIndex = currentOrder.indexOf(dragState.sourceTabId)
  const toIndex = currentOrder.indexOf(targetTabId)
  
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return
  
  // 移除源 tab
  currentOrder.splice(fromIndex, 1)
  
  // 移除后 target 的索引可能偏移了（如果源在目标前面）
  const adjustedTargetIdx = fromIndex < toIndex ? toIndex - 1 : toIndex
  
  // 根据鼠标在目标 tab 的左半边还是右半边决定插入位置
  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const dropAfter = event.clientX > rect.left + rect.width / 2
  
  const insertAt = dropAfter ? adjustedTargetIdx + 1 : adjustedTargetIdx
  
  tabsStore.tabOrder = [
    ...currentOrder.slice(0, insertAt),
    dragState.sourceTabId,
    ...currentOrder.slice(insertAt)
  ]
}

async function handleDragEnd(event: DragEvent) {
  if (!dragState.sourceTabId) {
    resetDragState()
    return
  }
  
  const tab = getTab(dragState.sourceTabId)
  if (!tab) {
    resetDragState()
    return
  }
  
  // 已在 handleDrop 中完成 tab 间排序
  if (hasDroppedOnTab) {
    resetDragState()
    return
  }
  
  // 使用屏幕坐标（dragend 时 clientX/Y 可能为 0,0）
  const screenX = (window.screenLeft ?? window.screenX ?? 0) + event.clientX
  const screenY = (window.screenTop ?? window.screenY ?? 0) + event.clientY

  // 如果 clientX/Y 不可靠（皆为 0），则完全信任 dragState.targetType
  const coordsUnreliable = event.clientX === 0 && event.clientY === 0
  
  if (dragState.targetType === 'windowEdge' && dragState.targetWindowId && window.electronAPI) {
    try {
      await window.electronAPI.mergeTab(serializeTabForIPC(tab), dragState.targetWindowId)
      tabsStore.removeTab(dragState.sourceTabId)
    } catch (e) {
      console.error('Failed to merge tab to window edge:', e)
    }
  } else if (dragState.targetType === 'outsideWindow' || (!coordsUnreliable && isMouseOutsideWindow(event))) {
    if (window.electronAPI) {
      try {
        const otherWindows = windowList.value.filter(w => w.id !== currentWindowId)
        const targetWindow = 
          (dragState.targetWindowId 
            ? otherWindows.find(w => w.id === dragState.targetWindowId) 
            : null) 
          ?? findWindowAtPoint(otherWindows, screenX, screenY)
        
        if (targetWindow) {
          await window.electronAPI.mergeTab(serializeTabForIPC(tab), targetWindow.id)
        } else {
          await window.electronAPI.openNewWindow({ tabData: serializeTabForIPC(tab) })
        }
        
        tabsStore.removeTab(dragState.sourceTabId)
      } catch (e) {
        console.error('Failed to detach tab:', e)
      }
    }
  }
  
  resetDragState()
}

async function detachTab() {
  const tabId = contextMenu.value.tabId
  if (!tabId) return
  
  const tab = getTab(tabId)
  if (!tab) return
  
  if (window.electronAPI) {
    try {
      await window.electronAPI.openNewWindow({ tabData: serializeTabForIPC(tab) })
      tabsStore.removeTab(tabId)
    } catch (e) {
      console.error('Failed to detach tab:', e)
      alert('分离标签页失败，请重试')
    }
  } else {
    alert('此功能仅在 Electron 环境下可用')
  }
  
  hideContextMenu()
}

onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
  document.addEventListener('keydown', handleGlobalKeydown)
  
  const tabsContainer = document.querySelector('.tabs-container') as HTMLElement
  if (tabsContainer) {
    tabsContainer.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault()
      tabsContainer.scrollLeft += e.deltaY
    }, { passive: false })
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
  document.removeEventListener('keydown', handleGlobalKeydown)
  if (dragLeaveTimer) {
    clearTimeout(dragLeaveTimer)
  }
})
</script>

<style scoped lang="scss">
.tab-bar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--tab-bar-bg);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  position: relative;
}

.tabs-container {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--scrollbar-color);
    border-radius: 2px;
  }
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 36px;
  min-width: 120px;
  max-width: 200px;
  background: var(--tab-bg);
  border-right: 1px solid var(--border-color);
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
  }

  &.active {
    background: var(--tab-active-bg);
    border-bottom: 2px solid var(--primary-color);
  }
  
  &.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }
  
  &.drag-over {
    background: var(--sidebar-hover-bg);
    border-bottom: 2px dashed var(--primary-color);
  }
}

.tab-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-primary);
}

.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;

  &:hover {
    background: var(--close-btn-hover-bg);
    color: var(--text-primary);
  }
}

.dirty-indicator {
  color: var(--primary-color);
  font-size: 10px;
}

.tab-actions {
  display: flex;
  align-items: center;
}

.search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--tab-hover-bg);
    color: var(--text-primary);
  }
}

.tab-context-menu {
  position: fixed;
  background: var(--sidebar-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: background 0.15s;

  &:hover {
    background: var(--sidebar-hover-bg);
  }
}

.menu-text {
  flex: 1;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}
</style>

<style>
.tab-drag-ghost {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  background: var(--tab-active-bg, #fff);
  border: 1px solid var(--primary-color, #409eff);
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary, #333);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transform: translate(-50%, -50%);
}

.window-edge-indicator {
  position: fixed;
  top: 0;
  bottom: 0;
  width: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 9998;
  transition: opacity 0.2s;
  
  &.left {
    left: 0;
    background: linear-gradient(to right, rgba(64, 158, 255, 0.8), transparent);
  }
  
  &.right {
    right: 0;
    background: linear-gradient(to left, rgba(64, 158, 255, 0.8), transparent);
  }
  
  .edge-text {
    font-size: 11px;
    color: white;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    white-space: nowrap;
    margin-top: 8px;
  }
}

.outside-window-indicator {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(64, 158, 255, 0.9);
  border-radius: 8px;
  padding: 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  z-index: 9998;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  color: white;
  
  .outside-text {
    font-size: 14px;
    font-weight: 500;
  }
}
</style>
