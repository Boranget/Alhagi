import { ref } from 'vue'

/**
 * Check which file paths no longer exist on disk.
 * Uses batched IPC — single call for all paths, no caching.
 */
export function useFileExistenceChecker() {
  const missingFiles = ref<Set<string>>(new Set())

  async function checkFiles(filePaths: string[]) {
    if (!filePaths.length) {
      missingFiles.value = new Set()
      return
    }

    if (!window.electronAPI?.fileExistsBatch) return

    try {
      const res = await window.electronAPI.fileExistsBatch(filePaths)
      if (res.success && res.data) {
        const missing = new Set<string>()
        for (const [fp, exists] of Object.entries(res.data)) {
          if (!exists) missing.add(fp)
        }
        missingFiles.value = missing
      }
    } catch {
      // IPC error — treat all as missing
      missingFiles.value = new Set(filePaths)
    }
  }

  return { missingFiles, checkFiles }
}
