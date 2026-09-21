export interface IEditorContent {
  getMarkdown(tabId?: string): string
  getHTML(tabId?: string): string
  setTabContent(tabId: string, content: string): Promise<void>
  getCachedContent(tabId: string): string | undefined
  setCachedContent(tabId: string, content: string): void
  clearCache(): void
}
