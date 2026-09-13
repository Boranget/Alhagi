export interface SearchMatch {
  line: number
  column: number
  length: number
  text: string
  context?: string
}

export interface SearchQuery {
  pattern: string
  isRegex: boolean
  caseSensitive: boolean
  wholeWord: boolean
  searchIn: 'file' | 'folder' | 'all'
}

export interface SearchProps {
  query: SearchQuery | null
  matches: SearchMatch[]
  currentIndex: number
  total: number
}

export class Search {
  public query: SearchQuery | null
  public matches: SearchMatch[]
  public currentIndex: number
  public total: number

  constructor(props: SearchProps) {
    this.query = props.query
    this.matches = props.matches
    this.currentIndex = props.currentIndex
    this.total = props.total
  }

  static create(): Search {
    return new Search({
      query: null,
      matches: [],
      currentIndex: -1,
      total: 0,
    })
  }

  setQuery(query: SearchQuery): void {
    this.query = query
  }

  setMatches(matches: SearchMatch[]): void {
    this.matches = matches
    this.total = matches.length
    this.currentIndex = matches.length > 0 ? 0 : -1
  }

  clear(): void {
    this.query = null
    this.matches = []
    this.currentIndex = -1
    this.total = 0
  }

  findNext(): SearchMatch | null {
    if (this.matches.length === 0) {
      return null
    }

    this.currentIndex = (this.currentIndex + 1) % this.matches.length
    return this.matches[this.currentIndex]
  }

  findPrev(): SearchMatch | null {
    if (this.matches.length === 0) {
      return null
    }

    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length
    return this.matches[this.currentIndex]
  }

  getCurrentMatch(): SearchMatch | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
      return this.matches[this.currentIndex]
    }
    return null
  }

  hasNext(): boolean {
    return this.matches.length > 0
  }

  hasPrev(): boolean {
    return this.matches.length > 0
  }

  toProps(): SearchProps {
    return {
      query: this.query,
      matches: [...this.matches],
      currentIndex: this.currentIndex,
      total: this.total,
    }
  }
}
