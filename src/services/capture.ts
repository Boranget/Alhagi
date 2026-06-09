export interface CaptureResult {
  dataUrl: string
  width: number
  height: number
}

export function useCapture() {
  async function captureEditor(targetElement?: HTMLElement): Promise<CaptureResult | null> {
    try {
      const element = targetElement || document.querySelector('.editor-content') as HTMLElement

      if (!element) {
        return null
      }

      // 按需加载 html2canvas（~200KB），避免在首屏 bundle 中包含
      const { default: html2canvas } = await import('html2canvas')

      const canvas = await html2canvas(element, {
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false
      })

      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      }
    } catch (error) {
      return null
    }
  }

  async function copyCaptureToClipboard(result: CaptureResult): Promise<boolean> {
    try {
      const response = await fetch(result.dataUrl)
      const blob = await response.blob()
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ])
      return true
    } catch (error) {
      return false
    }
  }

  function downloadCapture(result: CaptureResult, filename: string = 'screenshot.png'): void {
    const link = document.createElement('a')
    link.href = result.dataUrl
    link.download = filename
    link.click()
  }

  return {
    captureEditor,
    copyCaptureToClipboard,
    downloadCapture
  }
}
