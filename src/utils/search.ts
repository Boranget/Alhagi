export interface SearchConfig {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export interface MatchRange {
  from: number
  to: number
}

export function buildSearchPattern(config: SearchConfig): RegExp | null {
  if (!config.search.trim()) {
    return null
  }

  try {
    let searchText = config.search

    if (!config.regexp) {
      searchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    if (config.wholeWord) {
      searchText = `\\b${searchText}\\b`
    }

    const flags = config.caseSensitive ? 'g' : 'gi'
    return new RegExp(searchText, flags)
  } catch {
    return null
  }
}

export function findMatchesInContent(content: string, config: SearchConfig): MatchRange[] {
  const matches: MatchRange[] = []
  const pattern = buildSearchPattern(config)

  if (!pattern) {
    return matches
  }

  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length
    })
  }

  return matches
}

export function replaceAllInContent(
  content: string,
  searchConfig: SearchConfig,
  replaceWith: string
): string {
  const pattern = buildSearchPattern(searchConfig)

  if (!pattern) {
    return content
  }

  return content.replace(pattern, replaceWith)
}

export function replaceSingleMatch(
  content: string,
  match: MatchRange,
  replaceWith: string
): string {
  return content.substring(0, match.from) + replaceWith + content.substring(match.to)
}

