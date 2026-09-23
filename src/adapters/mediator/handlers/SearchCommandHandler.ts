import type { ICommandHandler } from '@core/domain/ports/IMediator'
import { useSearchStore } from '@/stores/search'

export class SearchCommandHandler {
  private store = useSearchStore()

  async execute(payload?: unknown): Promise<unknown> {
    const { type, ...params } = payload as { type: string; [k: string]: any }
    switch (type) {
      case 'search:execute':
        return this.store.search(params.config, params.options)
      case 'search:findNext':
        return this.store.findNext()
      case 'search:findPrev':
        return this.store.findPrev()
      case 'search:replaceNext':
        return this.store.replaceNext(params.replacement)
      case 'search:replaceAll':
        return this.store.replaceAll(params.replacement)
      case 'search:clear':
        return this.store.clear()
      default:
        throw new Error(`Unknown search command: ${type}`)
    }
  }
}
