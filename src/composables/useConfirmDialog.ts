import { reactive } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmState extends Required<ConfirmOptions> {
  visible: boolean
}

interface ConfirmRequest {
  options: ConfirmOptions
  resolve: (value: boolean) => void
}

const state = reactive<ConfirmState>({
  visible: false,
  title: '确认操作',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
})

const queue: ConfirmRequest[] = []
let activeResolve: ((value: boolean) => void) | undefined

function applyOptions(options: ConfirmOptions): void {
  state.title = options.title ?? '确认操作'
  state.message = options.message
  state.confirmText = options.confirmText ?? '确定'
  state.cancelText = options.cancelText ?? '取消'
  state.danger = options.danger ?? false
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
 * 应用内确认弹窗。
 *
 * 不使用原生 window.confirm：Electron/Chromium 原生 modal 关闭后可能让
 * CodeMirror/ProseMirror 内部输入状态卡住（表现为必须点应用外再回来才能输入）。
 * 应用内弹窗始终留在 renderer 焦点体系内，避免 native focus 竞态。
 */
export function useConfirmDialog() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      queue.push({ options, resolve })
      if (!state.visible) showNext()
    })
  }

  function close(result: boolean): void {
    if (!state.visible) return

    const resolve = activeResolve
    const nextRequest = queue.shift()
    resolve?.(result)

    if (nextRequest) {
      activeResolve = nextRequest.resolve
      applyOptions(nextRequest.options)
      return
    }

    activeResolve = undefined
    state.visible = false
  }

  return { state, confirm, close }
}
