import { describe, it, expect } from 'vitest'
import { EditorPool } from '../EditorPool'
import type { ViewMode } from '@shared/types'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { ImageInsertService } from '@/services/image/ImageInsertService'
import type { ImageInsertOptions } from '@core/entities/image/ImageInsertOptions'
import type { ImageInsertContext } from '@core/domain/ports/services/image/IImageInsertStrategy'

// getScrollContainer 是滚动容器 DOM 映射的唯一权威
// （wysiwyg/split → Crepe 容器，source → CM scroller）。
// createTab 需要完整 Milkdown 运行时，这里白盒注入实例表，只测分支逻辑。

interface FakeInstance {
  viewMode: ViewMode
  crepeContainer: HTMLDivElement
  cmView: { scrollDOM: HTMLElement } | null
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
