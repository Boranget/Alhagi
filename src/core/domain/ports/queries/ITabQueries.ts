import type { Tab } from '@core/entities/Tab'

export interface ITabQueries {
  getById(id: string): Tab | undefined
  getAll(): Tab[]
  getActive(): Tab | undefined
  getDirty(): Tab[]
  findByPath(path: string): Tab | undefined
  getCount(): number
  getOrder(): string[]
  hasOpenFiles(): boolean
}
