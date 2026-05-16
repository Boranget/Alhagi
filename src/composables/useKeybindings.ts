import { ref, onMounted, onUnmounted, watch } from 'vue'
import { 
  DEFAULT_KEYBINDINGS, 
  type Keybinding,
  matchKeyEvent 
} from '@/services/keybindingService'
import { useTabsStore } from '@/stores/tabs'
import { usePreferencesStore } from '@/stores/preferences'

export function useKeybindings() {
  const tabsStore = useTabsStore()
  const prefsStore = usePreferencesStore()
  const keybindings = ref<Keybinding[]>([...DEFAULT_KEYBINDINGS])
  
  const emit = defineEmits<{
    (e: 'action', action: string): void
  }>()
  
  const actionHandlers: Record<string, () => void> = {
    'file.new': () => {
      tabsStore.createTab({ title: '未命名' })
    },
    'file.save': () => {
      const activeTab = tabsStore.activeTab
      if (activeTab) {
        tabsStore.saveFile(activeTab.id)
      }
    },
    'file.saveAs': () => {
      const activeTab = tabsStore.activeTab
      if (activeTab) {
        tabsStore.saveFileAs(activeTab.id)
      }
    },
    'file.close': () => {
      const activeTab = tabsStore.activeTab
      if (activeTab) {
        tabsStore.removeTab(activeTab.id)
      }
    },
    'edit.undo': () => {
      document.execCommand('undo')
    },
    'edit.redo': () => {
      document.execCommand('redo')
    },
    'edit.cut': () => {
      document.execCommand('cut')
    },
    'edit.copy': () => {
      document.execCommand('copy')
    },
    'edit.paste': () => {
      document.execCommand('paste')
    },
    'edit.selectAll': () => {
      document.execCommand('selectAll')
    },
    'view.toggleFullscreen': () => {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    },
  }
  
  function handleKeydown(event: KeyboardEvent) {
    // 忽略在输入框中的按键
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable) {
      return
    }
    
    for (const binding of keybindings.value) {
      if (matchKeyEvent(event, binding)) {
        event.preventDefault()
        
        const handler = actionHandlers[binding.action]
        if (handler) {
          handler()
          emit('action', binding.action)
        }
        
        break
      }
    }
  }
  
  function registerAction(action: string, handler: () => void) {
    actionHandlers[action] = handler
  }
  
  function getKeybindingForAction(action: string): Keybinding | undefined {
    return keybindings.value.find(kb => kb.action === action)
  }
  
  function updateKeybinding(action: string, newKeybinding: Partial<Keybinding>) {
    const index = keybindings.value.findIndex(kb => kb.action === action)
    if (index !== -1) {
      keybindings.value[index] = {
        ...keybindings.value[index],
        ...newKeybinding
      }
    }
  }
  
  function resetToDefaults() {
    keybindings.value = [...DEFAULT_KEYBINDINGS]
  }
  
  function exportKeybindings(): string {
    return JSON.stringify(keybindings.value, null, 2)
  }
  
  function importKeybindings(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Keybinding[]
      if (Array.isArray(imported)) {
        keybindings.value = imported
        return true
      }
    } catch {
      console.error('Failed to import keybindings')
    }
    return false
  }
  
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })
  
  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
  
  return {
    keybindings,
    registerAction,
    getKeybindingForAction,
    updateKeybinding,
    resetToDefaults,
    exportKeybindings,
    importKeybindings
  }
}
