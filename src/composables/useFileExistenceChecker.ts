import { ref, watch, onMounted } from 'vue'

/**
 * Check which file paths no longer exist on disk.
 * Returns a reactive Set of missing file paths.
 */
export function useFileExistenceChecker() {
  const missingFiles = ref<Set<string>>(new Set())

  async function checkFiles(filePaths: string[]) {
    if (!window.electronAPI?.fileExists) return

    const results = await Promise.all(
      filePaths.map(async (fp) => {
        try {
          const res = await window.electronAPI!.fileExists(fp)
          return { fp, exists: res.success && res.data === true }
        } catch {
          return { fp, exists: false }
        }
      }),
    )

    const missing = new Set<string>()
    for (const { fp, exists } of results) {
      if (!exists) missing.add(fp)
    }
    missingFiles.value = missing
  }

  return { missingFiles, checkFiles }
}
