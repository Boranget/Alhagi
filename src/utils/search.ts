// Keep search utilities for compatibility
// These are used for global file search and content manipulation

export interface SearchConfig {
  search: string
  caseSensitive: boolean
  wholeWord: boolean
  regexp: boolean
}

export interface MatchRange {
  from: number
  to: number
  text: string
}

export interface ReplaceResult {
  success: boolean
  newContent?: string
  error?: string
}

export function buildSearchPattern(config: SearchConfig): RegExp | null {
  if (!config.search) {
    return null
  }

  let patternString = config.search

  if (!config.regexp) {
    patternString = patternString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  if (config.wholeWord) {
    patternString = `\\b${patternString}\\b`
  }

  const flags = config.caseSensitive ? 'g' : 'gi'

  try {
    return new RegExp(patternString, flags)
  } catch {
    return null
  }
}

export function findMatchesInContent(
  content: string,
  config: SearchConfig
): MatchRange[] {
  const matches: MatchRange[] = []
  const pattern = buildSearchPattern(config)

  if (!pattern) {
    return matches
  }

  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    matches.push({
      from: match.index,
      to: match.index + match[0].length,
      text: match[0]
    })
  }

  return matches
}

export function replaceAllInContent(
  content: string,
  config: SearchConfig,
  replacement: string
): string {
  const pattern = buildSearchPattern(config)
  if (!pattern) {
    return content
  }
  return content.replace(pattern, replacement)
}

export function replaceSingleMatch(
  content: string,
  match: MatchRange,
  replacement: string
): string {
  return content.slice(0, match.from) + replacement + content.slice(match.to)
}
