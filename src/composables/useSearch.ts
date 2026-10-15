import { inject, provide, ref, shallowRef, type InjectionKey, type Ref } from 'vue'
import type { SearchService } from '@/services/search'

export const SearchServiceKey: InjectionKey<Ref<SearchService | null>> = Symbol('searchService')

export function provideSearchService(service: Ref<SearchService | null>) {
  provide(SearchServiceKey, service)
}

export function useSearch(): Ref<SearchService | null> {
  return inject(SearchServiceKey, ref(null))
}

/**
 * viewer 搜索注册槽（方案 D 第 2 步·搜索端口）：
 * EditorContainer 在最外层提供，descriptor viewer（PlainTextEditor 等）
 * 挂载时把 searchManager 注册进来、卸载时注销。
 *
 * EditorContainer 的 searchService 计算据此在 viewer tab 上把 Ctrl+F 路由到
 * viewer 自己的 CM 搜索服务，而不是被覆盖层遮住的 markdown 主编辑器（Crepe）。
 *
 * 必须用 shallowRef：ref() 会把对象值包成 reactive proxy，
 * proxy !== 原实例，viewer 注销时的 === 回环保护会失效。
 */
export const ViewerSearchSlotKey: InjectionKey<Ref<SearchService | null>> = Symbol('viewerSearchSlot')

export function provideViewerSearchSlot(slot: Ref<SearchService | null>): void {
  provide(ViewerSearchSlotKey, slot)
}

export function useViewerSearchSlot(): Ref<SearchService | null> {
  // 无提供者时返回一次性 ref：viewer 独立挂载（单测/未来复用）注册静默 no-op
  return inject(ViewerSearchSlotKey, shallowRef(null))
}
