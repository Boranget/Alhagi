import type { ISearchRepository } from '@core/interfaces/repositories/ISearchRepository'
import type { ITabRepository } from '@core/interfaces/repositories/ITabRepository'
import type { IEventBus } from '@core/interfaces/gateways/IEventBus'

export class ReplaceInFile {
  constructor(
    private searchRepository: ISearchRepository,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(replacement: string): Promise<boolean> {
    const tab = this.tabRepository.getActiveTab()
    if (!tab) {
      return false
    }

    const query = this.searchRepository.getQuery()
    if (!query) {
      return false
    }

    const currentMatch = this.searchRepository.getCurrentMatch()
    if (!currentMatch) {
      return false
    }

    const lines = tab.content.split('\n')
    const line = lines[currentMatch.line]

    const before = line.substring(0, currentMatch.column)
    const after = line.substring(currentMatch.column + currentMatch.length)

    lines[currentMatch.line] = before + replacement + after

    const newContent = lines.join('\n')

    this.tabRepository.update(tab.id, { content: newContent } as any)
    this.tabRepository.markDirty(tab.id)

    this.eventBus.emit('editor:content:changed', {
      content: newContent,
      tabId: tab.id,
    })

    return true
  }
}
