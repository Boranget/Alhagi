import { reactive } from 'vue'
import type { SelectOption } from '@/components/common/SelectDialog.vue'

export interface SelectDialogOptions {
  title: string
  options: SelectOption[]
  cancelText?: string
}

interface SelectDialogState {
  visible: boolean
  title: string
  options: SelectOption[]
  cancelText: string
}

interface SelectDialogRequest {
  options: SelectDialogOptions
  resolve: (value: string | null) => void
}

const state = reactive<SelectDialogState>({
  visible: false,
  title: '',
  options: [],
  cancelText: '取消',
})

const queue: SelectDialogRequest[] = []
let activeResolve: ((value: string | null) => void) | undefined

function applyOptions(options: SelectDialogOptions): void {
  state.title = options.title
  state.options = options.options
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
 * 应用内选择弹窗。
 * 替代原生 window.prompt 的多选项场景，提供可视化的选项列表。
 */
export function useSelectDialog() {
  function select(options: SelectDialogOptions): Promise<string | null> {
    return new Promise((resolve) => {
      queue.push({ options, resolve })
      if (!state.visible) {
        showNext()
      }
    })
  }

  function onSelect(value: string): void {
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
    select,
    onSelect,
    cancel,
  }
}
