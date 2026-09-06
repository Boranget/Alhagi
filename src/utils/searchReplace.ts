export function isInvalidRegexQuery(pattern: string): boolean {
  try {
    const regex = new RegExp(pattern)
    return regex.test('')
  } catch {
    return true
  }
}

export function expandRegexReplacement(replacement: string, match: RegExpExecArray): string {
  return replacement.replace(/\$([$&]|\d+)/g, (fullMatch, token: string) => {
    if (token === '$') return '$'
    if (token === '&') return match[0] ?? ''

    for (let length = token.length; length > 0; length--) {
      const groupIndex = Number(token.slice(0, length))
      if (groupIndex > 0 && groupIndex < match.length) {
        return `${match[groupIndex] ?? ''}${token.slice(length)}`
      }
    }

    return fullMatch
  })
}
