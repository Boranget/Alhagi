import type { ITabQueries } from './ITabQueries'
import type { IPreferenceQueries } from './IPreferenceQueries'
import type { ISearchQueries } from './ISearchQueries'

export interface IQueryRegistry {
  readonly tabs: ITabQueries
  readonly preferences: IPreferenceQueries
  readonly search: ISearchQueries
}
