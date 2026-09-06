import { ref } from 'vue'

export interface ToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
}

const toastRef = ref<{ show: (msg: string, options?: ToastOptions) => void; hide: () => void } | null>(null)

export function useToast() {
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

// 模块级导出，供非 Vue 组件（如 class service）直接调用
export const toast = {
  show: (msg: string, options?: ToastOptions) => toastRef.value?.show(msg, options),
  success: (msg: string) => toastRef.value?.show(msg, { type: 'success' }),
  error: (msg: string) => toastRef.value?.show(msg, { type: 'error', duration: 5000 }),
  warning: (msg: string) => toastRef.value?.show(msg, { type: 'warning', duration: 4000 }),
  info: (msg: string) => toastRef.value?.show(msg, { type: 'info' }),
}
