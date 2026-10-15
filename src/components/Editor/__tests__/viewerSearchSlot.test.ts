import { describe, it, expect, vi, afterEach } from 'vitest'
import { shallowRef, defineComponent, createApp, h, nextTick, type App, type Ref } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import PlainTextEditor from '../PlainTextEditor.vue'
import { provideViewerSearchSlot, useViewerSearchSlot } from '@/composables/useSearch'
import type { SearchService } from '@/services/search'

// preferences store 有 ThemeService / i18n / electron 副作用链，mock 掉
// （形状须为 reactive({ theme: ref })，同 useCmDocumentView.test.ts）。
vi.mock('@/stores/preferences', async () => {
  const { ref, reactive } = await import('vue')
  const inner = ref<string>('light')
  return { usePreferencesStore: () => reactive({ theme: inner }) }
})

/**
 * viewer 搜索槽端口（方案 D 第 2 步）：
 * EditorContainer provideViewerSearchSlot → PlainTextEditor 挂载注册 searchManager、
 * 卸载注销 → EditorContainer 的 searchService computed 把 Ctrl+F 路由到槽位服务。
 */
function mountEditor(opts: { withProvider: boolean }) {
  let slot!: Ref<SearchService | null>
  let injected: Ref<SearchService | null> | null = null
  let app: App | null = null
  const el = document.createElement('div')
  document.body.appendChild(el)
  const pinia: Pinia = createPinia()

  const Child = defineComponent({
    setup() {
      // 消费端（模拟 EditorContainer searchService 的读取）拿到同一 ref
      injected = useViewerSearchSlot()
      return () => h('div')
    },
  })

  const Harness = defineComponent({
    setup() {
      // shallowRef 与 EditorContainer 一致 —— ref 会把 service 包成 proxy 导致 === 保护失效
      slot = shallowRef<SearchService | null>(null)
      if (opts.withProvider) {
        provideViewerSearchSlot(slot)
      }
      return () => h('div', [h(PlainTextEditor, { modelValue: 'hello txt' }), h(Child)])
    },
  })

  app = createApp(Harness)
  app.use(pinia)
  app.mount(el)

  return {
    get slot() {
      return slot
    },
    get injected() {
      return injected
    },
    async unmount() {
      app?.unmount()
      el.remove()
      await nextTick()
    },
  }
}

describe('viewer 搜索槽端口', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('PlainTextEditor 挂载后把 searchManager 注册进槽位', async () => {
    const { slot, injected } = mountEditor({ withProvider: true })
    await nextTick()

    const service = slot.value
    expect(service).not.toBeNull()
    expect(typeof service!.search).toBe('function')
    expect(typeof service!.clear).toBe('function')
    expect(typeof service!.findNext).toBe('function')
    expect(typeof service!.isReplacing).toBe('boolean')

    // 消费端注入到同一个 ref（EditorContainer searchService 读的就是它）
    expect(injected!.value).toBe(service)

    // 注册的服务可用：clear 对活着的 CM view 幂等
    expect(() => service!.clear()).not.toThrow()
  })

  it('卸载后槽位清空，不留悬空引用', async () => {
    const { slot, unmount } = mountEditor({ withProvider: true })
    await nextTick()
    expect(slot.value).not.toBeNull()

    await unmount()
    expect(slot.value).toBeNull()
  })

  it('无提供者时挂载 / 卸载静默通过（一次性 ref no-op）', async () => {
    const { slot, unmount } = mountEditor({ withProvider: false })
    await nextTick()

    // 无提供者：inject 拿到组件自己的默认 ref，注册进孤岛，外部 slot 不被触碰
    expect(slot.value).toBeNull()

    await unmount()
    expect(slot.value).toBeNull()
  })
})
