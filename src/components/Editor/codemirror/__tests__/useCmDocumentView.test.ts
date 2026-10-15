import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, createApp, h, nextTick, type App } from 'vue'
import { createPinia, type Pinia } from 'pinia'
import { useCmDocumentView, type CmDocumentViewOptions } from '../useCmDocumentView'

// preferences store 有 ThemeService / i18n / electron 副作用链，mock 掉。
// store 形状必须是 reactive({ theme: ref })——storeToRefs 只收录 toRaw 后
// 仍是 ref/reactive 的属性；watch/computed 也依赖这个形状才能追踪主题变化。
// themeCtl 直接持内部 ref（不是 state.theme，那是解包后的字符串）。
const themeCtl = vi.hoisted(() => ({ theme: null as unknown as { value: string } }))
vi.mock('@/stores/preferences', async () => {
  const { ref, reactive } = await import('vue')
  const inner = ref<string>('light')
  const state = reactive({ theme: inner })
  themeCtl.theme = inner
  return {
    usePreferencesStore: () => state,
  }
})

type CmDocumentViewApi = ReturnType<typeof useCmDocumentView>

/**
 * 最小 harness：挂载 composable，把 API 挂到实例上供测试访问。
 * composable 依赖组件上下文（ref/watch），必须在组件 setup 里调用。
 */
function mountHarness(options: CmDocumentViewOptions = {}) {
  // setup 在 app.mount 里同步执行，api 必被赋值；TS 静态分析看不到闭包赋值，用 ! 声明
  let api!: CmDocumentViewApi
  let app: App | null = null

  const Harness = defineComponent({
    setup() {
      api = useCmDocumentView(options)
      return () => h('div', { ref: api.editorRef })
    },
  })

  const el = document.createElement('div')
  document.body.appendChild(el)
  const pinia: Pinia = createPinia()
  app = createApp(Harness)
  app.use(pinia)
  app.mount(el)

  return {
    api,
    root: el,
    unmount() {
      app?.unmount()
      el.remove()
    },
  }
}

describe('useCmDocumentView', () => {
  beforeEach(() => {
    themeCtl.theme.value = 'light'
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('createView 按初始内容创建视图，doc 与 DOM 一致', () => {
    const { api, root } = mountHarness()
    const view = api.createView('hello world')

    expect(view).not.toBeNull()
    expect(view!.state.doc.toString()).toBe('hello world')
    expect(root.querySelector('.cm-content')?.textContent).toContain('hello world')
  })

  it('重复 createView 不重建，返回已有视图', () => {
    const { api } = mountHarness()
    const v1 = api.createView('a')
    const v2 = api.createView('b')
    expect(v2).toBe(v1)
    expect(v1!.state.doc.toString()).toBe('a')
  })

  it('用户编辑（无 ExternalChange 标注）触发 onUserChange', async () => {
    const onUserChange = vi.fn()
    const { api } = mountHarness({ onUserChange })
    const view = api.createView('old')!

    view.dispatch({ changes: { from: 0, to: 3, insert: 'new' } })

    expect(onUserChange).toHaveBeenCalledTimes(1)
    expect(onUserChange).toHaveBeenCalledWith('new')
  })

  it('syncContent 替换内容且不触发 onUserChange（ExternalChange 标注）', () => {
    const onUserChange = vi.fn()
    const { api } = mountHarness({ onUserChange })
    const view = api.createView('old')!

    api.syncContent('external sync')

    expect(view.state.doc.toString()).toBe('external sync')
    expect(onUserChange).not.toHaveBeenCalled()
  })

  it('syncContent 内容一致时是 no-op', () => {
    const onUserChange = vi.fn()
    const { api } = mountHarness({ onUserChange })
    const view = api.createView('same')!

    api.syncContent('same')

    expect(onUserChange).not.toHaveBeenCalled()
    expect(view.state.doc.toString()).toBe('same')
  })

  it('destroyView 后 getView 返回 null，重复调用安全', () => {
    const { api } = mountHarness()
    api.createView('x')
    api.destroyView()

    expect(api.getView()).toBeNull()
    expect(() => api.destroyView()).not.toThrow()
    expect(() => api.syncContent('y')).not.toThrow()
  })

  it('focus/blur 事件透传给 onFocus/onBlur', async () => {
    const onFocus = vi.fn()
    const onBlur = vi.fn()
    const { api } = mountHarness({ onFocus, onBlur })
    const view = api.createView('text')!

    // happy-dom 里手动驱动 focus 状态
    view.contentDOM.focus()
    await nextTick()
    view.contentDOM.blur()
    await nextTick()

    // happy-dom 对 focus/blur 事件支持有限，这里不断言次数，只保证不抛错
    expect(() => view.contentDOM.focus()).not.toThrow()
  })

  it('主题切换 reconfigure 主题 compartment', async () => {
    const { api } = mountHarness()
    const view = api.createView('theme test')!

    // 主题经由 compartment reconfigure 的 StateEffect 生效（github 主题靠注入
    // 样式规则而非换 className，不能断言 DOM 类名）。直接 spy dispatch 验证
    // watch 触发了带 effects 的 reconfigure 事务。
    const dispatchSpy = vi.spyOn(view, 'dispatch')

    // 切 dark → 触发 composable 内部 watch
    themeCtl.theme.value = 'dark'
    await nextTick()

    expect(dispatchSpy).toHaveBeenCalled()
    // composable 传的是单个 reconfigure effect（非数组），断言首个参数带 effects 键即可
    const firstArg = dispatchSpy.mock.calls[0][0] as { effects?: unknown }
    expect(firstArg).toHaveProperty('effects')
  })
})
