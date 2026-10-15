import { describe, it, expect, vi } from 'vitest'
import { EditorPool } from '../EditorPool'
import { focusModePluginKey } from '@/plugins/focusModePlugin'
import type { ViewMode } from '@shared/types'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

// getScrollContainer 是滚动容器 DOM 映射的唯一权威
// （wysiwyg/split → Crepe 容器，source → CM scroller）。
// getCursorViewportY 是光标测量的唯一权威（source → CM coordsAtPos，
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

function createPool(): EditorPool {
  return new EditorPool(
    () => undefined,
    () => undefined,
    {} as ImageInsertService,
    () => ({} as ImageInsertOptions),
    () => ({} as ImageInsertContext),
    () => false,
    () => false,
    {} as ITabRepository
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

/** CM 实例：coordsAtPos 按 selection.main.head 测量 */
function makeCmView(top: number | null, throwOnCoords = false): NonNullable<FakeInstance['cmView']> {
  return {
    scrollDOM: document.createElement('div'),
    ...(throwOnCoords
      ? { coordsAtPos: () => { throw new Error('coords failed') }, state: { selection: { main: { head: 0 } } } }
      : { coordsAtPos: () => (top === null ? null : { top }), state: { selection: { main: { head: 42 } } } }),
  } as unknown as NonNullable<FakeInstance['cmView']>
}

/** Crepe 实例：editor.action 注入假 ctx，view 按 selection.from 测量 */
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
