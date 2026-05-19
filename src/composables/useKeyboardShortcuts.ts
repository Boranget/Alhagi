import { onMounted, onUnmounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'
import { useWritingEnhancement } from '@/composables/useWritingEnhancement'
import { useExport } from '@/composables/useExport'

export function useKeyboardShortcuts() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const { toggleFocusMode, toggleTypewriterMode } = useWritingEnhancement()
  const { showExportDialog } = useExport()

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'F11') {
      event.preventDefault()
      prefsStore.showSidebar = !prefsStore.showSidebar
      return
    }

    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 's':
          event.preventDefault()
          if (event.shiftKey) {
            tabsStore.saveFileAs(tabsStore.activeTabId!)
          } else {
            tabsStore.saveFile(tabsStore.activeTabId!)
          }
          break
        case 'n':
          event.preventDefault()
          if (event.shiftKey) {
            if (window.electronAPI) {
              window.electronAPI.openFolder().then((result: unknown) => {
                const folderResult = result as { success: boolean; data?: { path: string } }
                if (folderResult.success && folderResult.data) {
                  import('@/services/fileService').then(({ useFileService }) => {
                    const fileService = useFileService()
                    fileService.openFolderByPath(folderResult.data!.path)
                  })
                }
              })
            }
          } else {
            tabsStore.createTab({ title: '未命名' })
          }
          break
        case 'o':
          event.preventDefault()
          if (event.shiftKey) {
            tabsStore.openFile()
          } else {
            if (window.electronAPI) {
              window.electronAPI.openFile().then((result: unknown) => {
                const fileResult = result as { success: boolean; data?: { filePath: string; content: string } }
                if (fileResult.success && fileResult.data) {
                  const { filePath, content } = fileResult.data
                  const title = filePath.split(/[/\\]/).pop()?.split(/[/\\]/).pop() || '未命名'
                  tabsStore.createTab({
                    title,
                    content,
                    filePath
                  })
                  prefsStore.addRecentFile(filePath, title)
                }
              })
            }
          }
          break
        case 'b':
          event.preventDefault()
          prefsStore.showSidebar = !prefsStore.showSidebar
          break
        case ',':
          event.preventDefault()
          // Settings dialog - will be handled by App.vue
          break
        case 'w':
          event.preventDefault()
          if (event.shiftKey) {
            if (tabsStore.activeTabId) {
              const tab = tabsStore.tabs.get(tabsStore.activeTabId)
              if (tab?.isDirty) {
                if (confirm('文件有未保存的更改，确定要关闭吗？')) {
                  tabsStore.removeTab(tabsStore.activeTabId)
                }
              } else {
                tabsStore.removeTab(tabsStore.activeTabId)
              }
            }
          } else {
            if (tabsStore.activeTabId) {
              tabsStore.removeTab(tabsStore.activeTabId)
            }
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          event.preventDefault()
          const index = parseInt(event.key) - 1
          if (index >= 0 && index < tabsStore.tabOrder.length) {
            tabsStore.switchTab(tabsStore.tabOrder[index])
          }
          break
        }
        case 'tab':
          event.preventDefault()
          if (tabsStore.tabOrder.length > 0) {
            const currentIndex = tabsStore.tabOrder.indexOf(tabsStore.activeTabId!)
            const nextIndex = event.shiftKey
              ? (currentIndex - 1 + tabsStore.tabOrder.length) % tabsStore.tabOrder.length
              : (currentIndex + 1) % tabsStore.tabOrder.length
            tabsStore.switchTab(tabsStore.tabOrder[nextIndex])
          }
          break
        case 'p':
          if (event.shiftKey) {
            event.preventDefault()
            toggleFocusMode()
          }
          break
        case 't':
          if (event.shiftKey) {
            event.preventDefault()
            toggleTypewriterMode()
          }
          break
        case 'e':
          if (event.shiftKey) {
            event.preventDefault()
            showExportDialog()
          }
          break
      }
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
