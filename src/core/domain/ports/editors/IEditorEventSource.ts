export interface IEditorEventSource {
  onContentChange(callback: (markdown: string) => void): () => void
  onCursorChange(callback: (from: number, to: number) => void): () => void
}
