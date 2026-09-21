export interface ILayoutRepository {
  getShowSidebar(): boolean
  getShowTabBar(): boolean
  getShowStatusBar(): boolean
  isStickyNoteMode(): boolean
  isImmersiveMode(): boolean
}
