import { ref } from 'vue'

export interface ToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

type ToastInstance = { show: (msg: string, options?: ToastOptions) => void; hide: () => void }

// 模块级闭包：共享同一份 toastRef，但不作为模块顶层导出
let _toastRef: ReturnType<typeof ref<ToastInstance | null>> | null = null

function getSharedToastRef() {
  if (!_toastRef) _toastRef = ref<ToastInstance | null>(null)
  return _toastRef
}

export function useToast() {
  const toastRef = getSharedToastRef()

  function show(message: string, options?: ToastOptions) {
    toastRef.value?.show(message, options)
  }

  function success(message: string) {
    show(message, { type: 'success' })
  }

  function error(message: string) {
    show(message, { type: 'error', duration: 5000 })
  }

  function warning(message: string) {
    show(message, { type: 'warning', duration: 4000 })
  }

  function info(message: string) {
    show(message, { type: 'info' })
  }

  return { show, success, error, warning, info, toastRef }
}

// 模块级单例对象，供非 Vue 组件（如 class service）直接调用
export const toast = {
  show: (msg: string, options?: ToastOptions) => getSharedToastRef().value?.show(msg, options),
  success: (msg: string) => getSharedToastRef().value?.show(msg, { type: 'success' }),
  error: (msg: string) => getSharedToastRef().value?.show(msg, { type: 'error', duration: 5000 }),
  warning: (msg: string) => getSharedToastRef().value?.show(msg, { type: 'warning', duration: 4000 }),
  info: (msg: string) => getSharedToastRef().value?.show(msg, { type: 'info' }),
}
