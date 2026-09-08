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

// 模块级闭包：共享同一份状态，但不在模块顶层暴露 queue/activeResolve
let _sharedState: ReturnType<typeof reactive<ConfirmState>> | null = null
const _queue: ConfirmRequest[] = []
let _activeResolve: ((value: boolean) => void) | undefined

function getSharedState() {
  if (!_sharedState) {
    _sharedState = reactive<ConfirmState>({
      visible: false,
      title: '确认操作',
      message: '',
      confirmText: '确定',
      cancelText: '取消',
      danger: false,
    })
  }
  return _sharedState
}

function applyOptions(state: ConfirmState, options: ConfirmOptions): void {
  state.title = options.title ?? '确认操作'
  state.message = options.message
  state.confirmText = options.confirmText ?? '确定'
  state.cancelText = options.cancelText ?? '取消'
  state.danger = options.danger ?? false
}

function showNext(state: ConfirmState): void {
  const request = _queue.shift()
  if (!request) {
    _activeResolve = undefined
    state.visible = false
    return
  }

  _activeResolve = request.resolve
  applyOptions(state, request.options)
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
  const state = getSharedState()

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      _queue.push({ options, resolve })
      if (!state.visible) showNext(state)
    })
  }

  function close(result: boolean): void {
    if (!state.visible) return

    const resolve = _activeResolve
    const nextRequest = _queue.shift()
    resolve?.(result)

    if (nextRequest) {
      _activeResolve = nextRequest.resolve
      applyOptions(state, nextRequest.options)
      return
    }

    _activeResolve = undefined
    state.visible = false
  }

  return { state, confirm, close }
}
