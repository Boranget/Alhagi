import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick, defineComponent, createApp, h } from 'vue'
import { provideSearchService, useSearch } from '../useSearch'
import type { SearchService } from '@/services/search'

describe('useSearch Composable', () => {
  it('should return null when no service is provided', async () => {
    let serviceValue: ReturnType<typeof useSearch> | undefined

    const TestComponent = defineComponent({
      setup() {
        serviceValue = useSearch()
        return () => h('div')
      }
    })

    const app = createApp(TestComponent)
    const container = document.createElement('div')
    app.mount(container)
    await nextTick()

    expect(serviceValue).toBeDefined()
    expect(serviceValue!.value).toBeNull()

    app.unmount()
  })

  it('should provide and inject SearchService', async () => {
    const mockService: SearchService = {
      search: vi.fn().mockReturnValue({ current: 0, total: 2 }),
      clear: vi.fn(),
      findNext: vi.fn().mockReturnValue({ current: 1, total: 2 }),
      findPrev: vi.fn().mockReturnValue({ current: 0, total: 2 }),
      replaceNext: vi.fn().mockReturnValue({ current: 0, total: 1 }),
      replaceAll: vi.fn().mockReturnValue({ replaced: 2 }),
    }

    let injectedValue: ReturnType<typeof useSearch> | undefined

    const ParentComponent = defineComponent({
      setup() {
        const service = ref<SearchService | null>(mockService)
        provideSearchService(service)
        return () => h('div', [h(ChildComponent)])
      }
    })

    const ChildComponent = defineComponent({
      setup() {
        injectedValue = useSearch()
        return () => h('div')
      }
    })

    const app = createApp(ParentComponent)
    const container = document.createElement('div')
    app.mount(container)
    await nextTick()

    expect(injectedValue).toBeDefined()
    // When provide/inject unwraps ref, the value should be the service directly
    expect(injectedValue!.value).toEqual(expect.objectContaining({
      search: expect.any(Function),
      clear: expect.any(Function),
      findNext: expect.any(Function),
      findPrev: expect.any(Function),
      replaceNext: expect.any(Function),
      replaceAll: expect.any(Function),
    }))

    app.unmount()
  })
})
