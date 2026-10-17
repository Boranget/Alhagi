import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockElectronService } = vi.hoisted(() => ({
  mockElectronService: {
    isAvailable: vi.fn().mockReturnValue(true),
    openFolder: vi.fn(),
    readDirectory: vi.fn(),
    readFile: vi.fn(),
    saveFile: vi.fn(),
    createFile: vi.fn(),
    createDirectory: vi.fn(),
    deleteFile: vi.fn(),
    renameFile: vi.fn(),
  },
}))

vi.mock('@/services/electron/ElectronService', () => ({
  electronService: mockElectronService,
}))

vi.mock('@/events/eventBus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
  AppEvents: { FOLDER_OPENED: 'folder:opened' },
}))

vi.mock('@electron-protocol/index', () => ({
  FILE_TYPES: {
    DIRECTORY: 'directory',
    FILE: 'file',
  },
}))

import { useFileExplorerStore } from '../fileExplorer'

describe('FileExplorer Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockElectronService.isAvailable.mockReturnValue(true)
  })

  describe('initial state', () => {
    it('should have empty state', () => {
      const store = useFileExplorerStore()
      expect(store.currentFolder).toBeNull()
      expect(store.fileTree).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('openFolder', () => {
    it('should open folder and populate tree', async () => {
      const store = useFileExplorerStore()
      const mockData = { path: '/docs', tree: [{ name: 'file.md', path: '/docs/file.md' }] }
      vi.mocked(mockElectronService.openFolder).mockResolvedValue({ success: true, data: mockData })

      const result = await store.openFolder()

      expect(store.currentFolder).toBe('/docs')
      expect(result).toEqual(mockData)
    })

    it('should set error when electron not available', async () => {
      mockElectronService.isAvailable.mockReturnValue(false)
      const store = useFileExplorerStore()

      await store.openFolder()

      expect(store.error).toBe('Electron API not available')
    })

    it('should handle open failure gracefully', async () => {
      vi.mocked(mockElectronService.openFolder).mockResolvedValue({ success: false })
      const store = useFileExplorerStore()

      const result = await store.openFolder()

      expect(result).toBeNull()
    })
  })

  describe('openFile', () => {
    it('should read file content', async () => {
      vi.mocked(mockElectronService.readFile).mockResolvedValue({ success: true, data: '# Hello' })
      const store = useFileExplorerStore()

      const content = await store.openFile('/path/to/file.md')

      expect(content).toBe('# Hello')
    })

    it('should return null when unavailable', async () => {
      mockElectronService.isAvailable.mockReturnValue(false)
      const store = useFileExplorerStore()

      const content = await store.openFile('/path/to/file.md')

      expect(content).toBeNull()
    })
  })

  describe('saveFile', () => {
    it('should save file content', async () => {
      vi.mocked(mockElectronService.saveFile).mockResolvedValue({ success: true })
      const store = useFileExplorerStore()

      const result = await store.saveFile('/path/to/file.md', '# Updated')

      expect(result).toBe(true)
      expect(mockElectronService.saveFile).toHaveBeenCalledWith('/path/to/file.md', '# Updated')
    })

    it('should return false on failure', async () => {
      vi.mocked(mockElectronService.saveFile).mockResolvedValue({ success: false })
      const store = useFileExplorerStore()

      const result = await store.saveFile('/path/to/file.md', 'content')

      expect(result).toBe(false)
    })
  })

  describe('createFile / createDirectory', () => {
    it('should create file and refresh tree', async () => {
      vi.mocked(mockElectronService.createFile).mockResolvedValue({ success: true, data: { path: '/docs/new.md' } })
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({ success: true, data: [] })
      const store = useFileExplorerStore()
      store.currentFolder = '/docs'

      const result = await store.createFile('/docs', 'new.md')

      expect(result).toEqual({ path: '/docs/new.md' })
    })

    it('should create directory and refresh tree', async () => {
      vi.mocked(mockElectronService.createDirectory).mockResolvedValue({ success: true, data: { path: '/docs/new-dir' } })
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({ success: true, data: [] })
      const store = useFileExplorerStore()
      store.currentFolder = '/docs'

      const result = await store.createDirectory('/docs', 'new-dir')

      expect(result).toEqual({ path: '/docs/new-dir' })
    })
  })

  describe('deleteFile', () => {
    it('should delete file and refresh tree', async () => {
      vi.mocked(mockElectronService.deleteFile).mockResolvedValue({ success: true })
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({ success: true, data: [] })
      const store = useFileExplorerStore()
      store.currentFolder = '/docs'

      const result = await store.deleteFile('/docs/file.md')

      expect(result).toBe(true)
    })
  })

  describe('renameFile', () => {
    it('should rename file and refresh tree', async () => {
      vi.mocked(mockElectronService.renameFile).mockResolvedValue({ success: true, data: { path: '/docs/renamed.md' } })
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({ success: true, data: [] })
      const store = useFileExplorerStore()
      store.currentFolder = '/docs'

      const result = await store.renameFile('/docs/old.md', 'renamed.md')

      expect(result).toEqual({ path: '/docs/renamed.md' })
    })
  })

  describe('openFolderByPath', () => {
    it('should open folder by explicit path', async () => {
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({ success: true, data: [] })
      const store = useFileExplorerStore()

      const result = await store.openFolderByPath('/some/path')

      expect(store.currentFolder).toBe('/some/path')
      expect(result?.path).toBe('/some/path')
    })
  })

  describe('toggleFolder', () => {
    it('should toggle expanded state and lazy load children', async () => {
      vi.mocked(mockElectronService.readDirectory).mockResolvedValue({
        success: true,
        data: [{ name: 'child.md', path: '/docs/child.md', isDirectory: false }],
      })
      const store = useFileExplorerStore()
      const node = { name: 'sub', path: '/docs/sub', type: 'directory', expanded: false, children: [] } as unknown as import('@/types').FileTreeNodeType

      await store.toggleFolder(node)

      expect(node.expanded).toBe(true)
      expect(node.children?.length).toBe(1)
    })
  })
})
