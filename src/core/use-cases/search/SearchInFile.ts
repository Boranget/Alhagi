import type { ISearchRepository } from '@core/domain/ports/repositories/ISearchRepository'
import type { ITabRepository } from '@core/domain/ports/repositories/ITabRepository'
import type { IEventBus } from '@core/domain/ports/gateways/IEventBus'
import type { SearchQuery, SearchMatch } from '@core/entities/Search'

export class SearchInFile {
  constructor(
    private searchRepository: ISearchRepository,
    private tabRepository: ITabRepository,
    private eventBus: IEventBus
  ) {}

  async execute(query: SearchQuery): Promise<SearchMatch[]> {
    const tab = this.tabRepository.getActiveTab()
    if (!tab) {
      return []
    }

    this.searchRepository.setQuery(query)

    const matches = this.findMatches(tab.content, query)

    this.searchRepository.setMatches(matches)

    return matches
  }

  private findMatches(content: string, query: SearchQuery): SearchMatch[] {
    const matches: SearchMatch[] = []
    const lines = content.split('\n')

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const lineMatches = this.findMatchesInLine(line, lineIndex, query)
      matches.push(...lineMatches)
    }

    return matches
  }

  private findMatchesInLine(line: string, lineIndex: number, query: SearchQuery): SearchMatch[] {
    const matches: SearchMatch[] = []
    let pattern: RegExp

    if (query.isRegex) {
      try {
        pattern = new RegExp(query.pattern, query.caseSensitive ? 'g' : 'gi')
      } catch {
        return matches
      }
    } else {
      const escaped = query.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const flags = query.caseSensitive ? 'g' : 'gi'
      pattern = query.wholeWord ? new RegExp(`\\b${escaped}\\b`, flags) : new RegExp(escaped, flags)
    }

    let match
    while ((match = pattern.exec(line)) !== null) {
      matches.push({
        line: lineIndex,
        column: match.index,
        length: match[0].length,
        text: match[0],
        context: line,
      })
    }

    return matches
  }
}
