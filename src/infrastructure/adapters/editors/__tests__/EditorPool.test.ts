import { describe, it, expect, vi } from 'vitest'
import { EditorPool } from '../EditorPool'
import { focusModePluginKey } from '@/plugins/focusModePlugin'
import type { ViewMode } from '@shared/types'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { Tab } from '@core/entities/Tab'
import type { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

// getScrollContainer 是滚动容器 DOM 映射的唯一权威
// （wysiwyg/split → Crepe 容器，source → CM scroller）。
// getCursorViewportY 是光标测量的唯一权威（source → CM coordsAtPos；
// wysiwyg/split → Crepe coordsAtPos）。
// createTab 需要完整 Milkdown 运行时，这里白盒注入实例表，只测分支逻辑。
interface FakeInstance {
  viewMode: ViewMode
  crepeContainer: HTMLDivElement
  cmView: { scrollDOM: HTMLElement } | null
  crepe?: unknown | null
}

type PoolInternals = {
  instances: Map<string, FakeInstance>
  activeTabId: string | null
}

function createPool(tabRepository: Partial<ITabRepository> = {}): EditorPool {
  return new EditorPool(
    () => undefined,
    () => undefined,
    {} as ImageInsertService,
    () => ({} as ImageInsertOptions),
    () => ({} as ImageInsertContext),
    () => false,
    () => false,
    tabRepository as ITabRepository
  )
}

function makeInstance(viewMode: ViewMode, withCmView: boolean = false): FakeInstance {
  return {
    viewMode,
    crepeContainer: document.createElement('div'),
    cmView: withCmView ? { scrollDOM: document.createElement('div') } : null,
  }
}

function inject(pool: EditorPool, activeTabId: string | null, entries: Record<string, FakeInstance> = {}): PoolInternals {
  const internals = pool as unknown as PoolInternals
  for (const [tabId, instance] of Object.entries(entries)) {
    internals.instances.set(tabId, instance)
  }
  internals.activeTabId = activeTabId
  return internals
}

describe('EditorPool.getScrollContainer', () => {
  it('should return null when there is no active tab', () => {
    const pool = createPool()
    inject(pool, null)

    expect(pool.getScrollContainer()).toBeNull()
  })

  it('should return null when the active tab has no instance yet (pending create)', () => {
    const pool = createPool()
    inject(pool, 'pending-tab')

    expect(pool.getScrollContainer()).toBeNull()
  })

  it('should return the Crepe container in wysiwyg mode', () => {
    const pool = createPool()
    const instance = makeInstance('wysiwyg')
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getScrollContainer()).toBe(instance.crepeContainer)
  })

  it('should return the Crepe container in split mode', () => {
    const pool = createPool()
    const instance = makeInstance('split', true)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getScrollContainer()).toBe(instance.crepeContainer)
  })

  it('should return the CM scroller in source mode', () => {
    const pool = createPool()
    const instance = makeInstance('source', true)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getScrollContainer()).toBe(instance.cmView?.scrollDOM ?? null)
  })

  it('should return null in source mode when CodeMirror view is not built', () => {
    const pool = createPool()
    inject(pool, 'tab-1', { 'tab-1': makeInstance('source') })

    expect(pool.getScrollContainer()).toBeNull()
  })

  it('should never return a non-active instance container', () => {
    const pool = createPool()
    const background = makeInstance('wysiwyg')
    inject(pool, 'active-tab', { 'background-tab': background })

    expect(pool.getScrollContainer()).toBeNull()
  })
})

// ── 光标测量：唯一权威在池（网关只做容器偏移换算） ──

/** CM 实例：coordsAtPos 与 selection.main.head 测量 */
function makeCmView(top: number | null, throwOnCoords = false): NonNullable<FakeInstance['cmView']> {
  return {
    scrollDOM: document.createElement('div'),
    ...(throwOnCoords
      ? { coordsAtPos: () => { throw new Error('coords failed') }, state: { selection: { main: { head: 0 } } } }
      : { coordsAtPos: () => (top === null ? null : { top }), state: { selection: { main: { head: 42 } } } }),
  } as unknown as NonNullable<FakeInstance['cmView']>
}

/** Crepe 实例：editor.action 注入假 ctx，view 与 selection.from 测量 */
function makeFakeCrepe(top: number | null): unknown {
  const view = {
    state: { selection: { from: 10 }, tr: { setMeta: vi.fn() } },
    coordsAtPos: () => (top === null ? null : { top }),
    dispatch: vi.fn(),
  }
  return {
    editor: {
      action: (fn: (ctx: { get: (k: unknown) => unknown }) => void) => fn({ get: () => view }),
    },
  }
}

describe('EditorPool.getCursorViewportY', () => {
  it('should return null when there is no active tab', () => {
    const pool = createPool()
    inject(pool, null)

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should return null when the active tab has no instance', () => {
    const pool = createPool()
    inject(pool, 'pending-tab')

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should measure via CM coordsAtPos in source mode', () => {
    const pool = createPool()
    const instance = makeInstance('source')
    instance.cmView = makeCmView(250)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getCursorViewportY()).toBe(250)
  })

  it('should return null in source mode when CodeMirror view is not built', () => {
    const pool = createPool()
    inject(pool, 'tab-1', { 'tab-1': makeInstance('source') })

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should return null in source mode when coordsAtPos throws', () => {
    const pool = createPool()
    const instance = makeInstance('source')
    instance.cmView = makeCmView(null, true)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should return null in wysiwyg mode when crepe is not built', () => {
    const pool = createPool()
    inject(pool, 'tab-1', { 'tab-1': makeInstance('wysiwyg') })

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should measure via Crepe coordsAtPos in wysiwyg mode', () => {
    const pool = createPool()
    const instance = makeInstance('wysiwyg')
    instance.crepe = makeFakeCrepe(400)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getCursorViewportY()).toBe(400)
  })

  it('should return null when coordsAtPos returns null (cursor not rendered)', () => {
    const pool = createPool()
    const instance = makeInstance('split')
    instance.crepe = makeFakeCrepe(null)
    inject(pool, 'tab-1', { 'tab-1': instance })

    expect(pool.getCursorViewportY()).toBeNull()
  })

  it('should never measure a non-active instance', () => {
    const pool = createPool()
    const background = makeInstance('wysiwyg')
    background.crepe = makeFakeCrepe(400)
    inject(pool, 'active-tab', { 'background-tab': background })

    expect(pool.getCursorViewportY()).toBeNull()
  })
})

describe('EditorPool.setEditorFocusMode', () => {
  it('should be a no-op without active instance or crepe', () => {
    const pool = createPool()
    inject(pool, null)
    expect(() => pool.setEditorFocusMode(true)).not.toThrow()

    inject(pool, 'tab-1', { 'tab-1': makeInstance('wysiwyg') })
    expect(() => pool.setEditorFocusMode(true)).not.toThrow()
  })

  it('should dispatch focus meta on the active crepe', () => {
    const pool = createPool()
    const setMeta = vi.fn()
    const dispatch = vi.fn()
    const view = {
      state: { selection: { from: 10 }, tr: { setMeta } },
      coordsAtPos: () => ({ top: 400 }),
      dispatch,
    }
    const instance = makeInstance('wysiwyg')
    instance.crepe = {
      editor: {
        action: (fn: (ctx: { get: (k: unknown) => unknown }) => void) => fn({ get: () => view }),
      },
    }
    inject(pool, 'tab-1', { 'tab-1': instance })

    pool.setEditorFocusMode(true)

    expect(setMeta).toHaveBeenCalledWith(focusModePluginKey, { enabled: true })
    expect(dispatch).toHaveBeenCalled()

    pool.setEditorFocusMode(false)
    expect(setMeta).toHaveBeenCalledWith(focusModePluginKey, { enabled: false })
  })
})

// ── markdownUpdated 提交：现场序列化，杜绝陈旧快照回退 ──
// 旧实现叠加第二层 debounce 并提交事件参数里的旧快照，比对必失败 →
// replaceAll(旧内容) 回退刚敲的字、组合期打断 IME（拼音残留）。
interface PrivatePool {
  instances: Map<string, unknown>
  activeTabId: string | null
  createMarkdownUpdatedHandler: (tabId: string) => (...args: unknown[]) => void
  handleCMUpdate: (tabId: string, content: string) => void
  applyContentToCrepe: (instance: unknown, content: string) => void
  applyContentToCM: (instance: unknown, content: string) => void
}

function injectRaw(pool: EditorPool, tabId: string, instance: unknown): void {
  const internals = pool as unknown as PrivatePool
  internals.instances.set(tabId, instance)
  internals.activeTabId = tabId
}

/** 只提供权威内容读取的最小仓库 */
function withContent(content: string): Partial<ITabRepository> {
  return { getById: vi.fn((): Tab | undefined => ({ content }) as unknown as Tab) }
}

describe('EditorPool markdownUpdated handler', () => {
  it('should commit live-serialized markdown instead of the event snapshot', () => {
    const pool = createPool()
    const commit = vi.fn()
    const docRef = { id: 'latest' }
    const instance = {
      tabId: 'tab-1',
      crepe: { getMarkdown: vi.fn(() => 'LIVE-MARKDOWN') },
      docSync: { commit },
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)

    const handler = (pool as unknown as PrivatePool).createMarkdownUpdatedHandler('tab-1')
    const ctx = { get: () => ({ state: { doc: docRef } }) }
    handler(ctx, 'STALE-SNAPSHOT', 'prev-markdown')

    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenCalledWith('LIVE-MARKDOWN')
    expect(commit).not.toHaveBeenCalledWith('STALE-SNAPSHOT')
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(1)
  })

  it('should skip commit when the doc is an echo of an applied authority push', () => {
    const pool = createPool()
    const commit = vi.fn()
    const docRef = { id: 'applied' }
    const instance = {
      tabId: 'tab-1',
      crepe: { getMarkdown: vi.fn(() => 'ANY') },
      docSync: { commit },
      lastAppliedCrepeDoc: docRef,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)

    const handler = (pool as unknown as PrivatePool).createMarkdownUpdatedHandler('tab-1')
    handler({ get: () => ({ state: { doc: docRef } }) }, 'x', 'y')

    expect(commit).not.toHaveBeenCalled()
    expect(instance.crepe.getMarkdown).not.toHaveBeenCalled()
  })

  it('should not commit when crepe is unavailable (rebuilding window)', () => {
    const pool = createPool()
    const commit = vi.fn()
    injectRaw(pool, 'tab-1', {
      tabId: 'tab-1',
      crepe: null,
      docSync: { commit },
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    })

    const handler = (pool as unknown as PrivatePool).createMarkdownUpdatedHandler('tab-1')
    handler({ get: () => ({ state: { doc: {} } }) }, 'x', 'y')

    expect(commit).not.toHaveBeenCalled()
  })

  // 组合期 PM 可能把裸拼音字母吞进 doc（Windows Chromium readDOMChange），
  // 此刻序列化的暂态内容绝不进权威（自动保存/回写管道会消费它）。
  it('should not commit while composing (transient pinyin must not enter authority)', () => {
    const pool = createPool()
    const commit = vi.fn()
    const instance = {
      tabId: 'tab-1',
      crepe: { getMarkdown: vi.fn(() => 'raw-pinyin') },
      docSync: { commit },
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)

    const handler = (pool as unknown as PrivatePool).createMarkdownUpdatedHandler('tab-1')
    handler({ get: () => ({ state: { doc: {} }, composing: true }) }, 'x', 'y')

    expect(commit).not.toHaveBeenCalled()
    expect(instance.crepe.getMarkdown).not.toHaveBeenCalled()
  })

  it('should commit CM content once composition ends', () => {
    const pool = createPool()
    const commit = vi.fn()
    const cmView: { composing: boolean } = { composing: true }
    injectRaw(pool, 'tab-1', {
      tabId: 'tab-1',
      crepe: null,
      cmView,
      docSync: { commit },
      lastAppliedCrepeDoc: null,
    })

    const internals = pool as unknown as PrivatePool
    internals.handleCMUpdate('tab-1', 'raw-pinyin')
    expect(commit).not.toHaveBeenCalled()

    cmView.composing = false
    internals.handleCMUpdate('tab-1', 'settled-chinese')
    expect(commit).toHaveBeenCalledWith('settled-chinese')
  })
})

// ── IME 组合期护栏：相等检查先于组合检查；仅真正不等的外部变更才挂起，
//    compositionend 后重读权威再应用 ──

describe('EditorPool composition guard', () => {
  it('should defer crepe apply during composition and re-read authority on compositionend', () => {
    const dom = document.createElement('div')
    const view = { composing: true, dom, state: { doc: {} } }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const pool = createPool(withContent('authority-latest'))
    const instance = {
      tabId: 'tab-1',
      crepe: {
        getMarkdown: vi.fn(() => 'authority-latest'),
        editor: {
          action: (fn: (ctx: { get: () => unknown }) => void) => fn({ get: () => view }),
        },
      },
      cmView: null,
      content: '',
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)
    const internals = pool as unknown as PrivatePool

    internals.applyContentToCrepe(instance, 'authority-content')

    // 内容不等 + 组合中 → 挂起，不派发（派发则假 ctx 的 replaceAll 会抛并被 catch 记录）
    expect(errorSpy).not.toHaveBeenCalled()
    expect(instance.compositionApplyPending).toBe(true)
    expect(instance.content).toBe('authority-content')
    // 挂起前已做相等检查（不等才走到组合检查）
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(1)

    view.composing = false
    dom.dispatchEvent(new Event('compositionend'))

    expect(instance.compositionApplyPending).toBe(false)
    // finish 重读权威最新值并重入 apply；内容相等 → 幂等早退，不派发
    expect(instance.content).toBe('authority-latest')
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(2)
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  // ni'h 回归护栏：组合期的 store 变更多为自身 echo，内容相等时必须直接
  // 返回、绝不挂起——否则 compositionend 的 finish 会拿暂态 store 覆盖刚
  // 落定的中文。
  it('should not defer when content already matches during composition', () => {
    const dom = document.createElement('div')
    const view = { composing: true, dom, state: { doc: {} } }
    const pool = createPool(withContent('same'))
    const instance = {
      tabId: 'tab-1',
      crepe: {
        getMarkdown: vi.fn(() => 'same'),
        editor: {
          action: (fn: (ctx: { get: () => unknown }) => void) => fn({ get: () => view }),
        },
      },
      cmView: null,
      content: '',
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)
    const internals = pool as unknown as PrivatePool

    internals.applyContentToCrepe(instance, 'same')

    expect(instance.compositionApplyPending).toBe(false)
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(1)

    // 未挂起 → compositionend 无监听器可触发，状态不变
    dom.dispatchEvent(new Event('compositionend'))
    expect(instance.compositionApplyPending).toBe(false)
  })

  it('should defer CM apply during composition and dispatch latest on compositionend', () => {
    const dom = document.createElement('div')
    const cmView = {
      composing: true,
      dom,
      state: { doc: { toString: () => 'editor', length: 6 } },
      dispatch: vi.fn(),
    }
    const pool = createPool(withContent('authority'))
    const instance = {
      tabId: 'tab-1',
      crepe: null,
      cmView,
      content: '',
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)
    const internals = pool as unknown as PrivatePool

    internals.applyContentToCM(instance, 'authority')

    // 内容不等（'editor' ≠ 'authority'）→ 组合中挂起，不派发
    expect(cmView.dispatch).not.toHaveBeenCalled()
    expect(instance.compositionApplyPending).toBe(true)

    cmView.composing = false
    dom.dispatchEvent(new Event('compositionend'))

    expect(instance.compositionApplyPending).toBe(false)
    // 重读权威后现场比对不等 → 真正派发（ExternalChange 注解在）
    expect(cmView.dispatch).toHaveBeenCalledTimes(1)
    expect(cmView.dispatch.mock.calls[0][0]).toMatchObject({ changes: { insert: 'authority' } })
  })

  it('should be idempotent: only one compositionend listener is scheduled', () => {
    const dom = document.createElement('div')
    const view = { composing: true, dom, state: { doc: {} } }
    const pool = createPool(withContent('settled'))
    const instance = {
      tabId: 'tab-1',
      crepe: {
        // 组合中序列化出编辑器暂态，落定后序列化出权威内容
        getMarkdown: vi.fn(() => (view.composing ? 'editor-typing' : 'settled')),
        editor: {
          action: (fn: (ctx: { get: () => unknown }) => void) => fn({ get: () => view }),
        },
      },
      cmView: null,
      content: '',
      lastAppliedCrepeDoc: null,
      compositionApplyPending: false,
    }
    injectRaw(pool, 'tab-1', instance)
    const internals = pool as unknown as PrivatePool

    internals.applyContentToCrepe(instance, 'settled')
    internals.applyContentToCrepe(instance, 'settled')
    internals.applyContentToCrepe(instance, 'settled')

    expect(instance.compositionApplyPending).toBe(true)
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(3)

    view.composing = false
    dom.dispatchEvent(new Event('compositionend'))

    expect(instance.compositionApplyPending).toBe(false)
    // 单 listener：finish 只跑一次 → 组合期 3 次挂起只对应 1 次重入比对
    expect(instance.crepe.getMarkdown).toHaveBeenCalledTimes(4)
  })
})
