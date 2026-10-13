import { getEditorServiceGateway } from '@adapters/gateways/EditorServiceGateway'
import { eventBus, AppEvents } from '@/events/eventBus'

export class EditCommandHandler {
  async execute(payload?: unknown): Promise<unknown> {
    const { type } = payload as { type: string }
    switch (type) {
      case 'edit:undo':
        getEditorServiceGateway().undo()
        return
      case 'edit:redo':
        getEditorServiceGateway().redo()
        return
      case 'edit:cut': {
        getEditorServiceGateway().focus()
        document.execCommand('cut')
        return
      }
      case 'edit:copy': {
        getEditorServiceGateway().focus()
        document.execCommand('copy')
        return
      }
      case 'edit:paste': {
        const gateway = getEditorServiceGateway()
        gateway.focus()
        // Chromium 禁止脚本触发原生粘贴（execCommand('paste') 返回 false）。
        // 回退：navigator.clipboard 读取纯文本 + 在光标处插入。
        try {
          if (document.execCommand('paste')) return
        } catch {
          // execCommand 不可用，走回退
        }
        try {
          const text = await navigator.clipboard.readText()
          if (text) gateway.insertText(text)
        } catch (error) {
          console.error('[EditCommandHandler] paste failed:', error)
        }
        return
      }
      case 'edit:selectAll':
        getEditorServiceGateway().selectAll()
        return
      case 'edit:find':
        eventBus.emit(AppEvents.SHOW_SEARCH)
        return
      case 'edit:replace':
        eventBus.emit(AppEvents.SHOW_SEARCH, { showReplace: true })
        return
      default:
        throw new Error(`Unknown edit command: ${type}`)
    }
  }
}
