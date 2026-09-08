import { reactive } from 'vue'

export interface InputDialogOptions {
  title: string
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
}

interface InputDialogState {
  visible: boolean
  title: string
  defaultValue: string
  placeholder: string
  confirmText: string
  cancelText: string
}

interface InputDialogRequest {
  options: InputDialogOptions
  resolve: (value: string | null) => void
}

const state = reactive<InputDialogState>({
  visible: false,
  title: '',
  defaultValue: '',
  placeholder: '',
  confirmText: '确定',
  cancelText: '取消',
})

const queue: InputDialogRequest[] = []
let activeResolve: ((value: string | null) => void) | undefined

function applyOptions(options: InputDialogOptions): void {
  state.title = options.title
  state.defaultValue = options.defaultValue ?? ''
  state.placeholder = options.placeholder ?? ''
  state.confirmText = options.confirmText ?? '确定'
  state.cancelText = options.cancelText ?? '取消'
}

function showNext(): void {
  const request = queue.shift()
  if (!request) {
    activeResolve = undefined
    state.visible = false
    return
  }

  activeResolve = request.resolve
  applyOptions(request.options)
  state.visible = true
}

/**
 * 应用内输入弹窗。
 * 替代原生 window.prompt，避免 Electron/Chromium 原生 modal 的焦点竞态问题。
 */
export function useInputDialog() {
  function prompt(options: InputDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
      queue.push({ options, resolve })
      if (!state.visible) {
        showNext()
      }
    })
  }

  function confirm(value: string): void {
    state.visible = false
    activeResolve?.(value)
    setTimeout(showNext, 0)
  }

  function cancel(): void {
    state.visible = false
    activeResolve?.(null)
    setTimeout(showNext, 0)
  }

  return {
    state,
    prompt,
    confirm,
    cancel,
  }
}
