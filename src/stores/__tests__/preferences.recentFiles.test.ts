import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { eventBus, AppEvents } from '@/events/eventBus'
import { usePreferencesStore } from '../preferences'

type ElectronApiStub = Record<string, unknown>

function setElectronAPI(api: ElectronApiStub): void {
  const win = window as unknown as { electronAPI?: ElectronApiStub }
  win.electronAPI = api
}

describe('preferences store — 最近文件', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    eventBus.clear()
    delete (window as unknown as { electronAPI?: ElectronApiStub }).electronAPI
  })

  afterEach(() => {
    eventBus.clear()
    delete (window as unknown as { electronAPI?: ElectronApiStub }).electronAPI
  })

  it('打开文件时用文件名作 title，而不是 tabId(UUID)', () => {
    const store = usePreferencesStore()

    eventBus.emit(AppEvents.FILE_OPENED, {
      filePath: 'C:\\docs\\笔记.md',
      tabId: '47909249-b259-4466-830e-77afa39fb538',
    })

    expect(store.recentFiles).toHaveLength(1)
    expect(store.recentFiles[0]).toMatchObject({
      filePath: 'C:\\docs\\笔记.md',
      title: '笔记',
      pinned: false,
    })
  })

  it('重复打开同一文件时刷新标题并置顶，不产生重复项', () => {
    const store = usePreferencesStore()

    eventBus.emit(AppEvents.FILE_OPENED, { filePath: '/docs/a.md', tabId: 'x' })
    eventBus.emit(AppEvents.FILE_OPENED, { filePath: '/docs/b.md', tabId: 'y' })
    eventBus.emit(AppEvents.FILE_OPENED, { filePath: '/docs/a.md', tabId: 'z' })

    expect(store.recentFiles.map(f => f.filePath)).toEqual(['/docs/a.md', '/docs/b.md'])
    expect(store.recentFiles[0].title).toBe('a')
  })

  it('启动加载时修复历史数据里的 UUID 标题并回写', async () => {
    const setOne = vi.fn(async () => ({ success: true, data: true }))
    setElectronAPI({
      preferencesGetAll: vi.fn(async () => ({
        success: true,
        data: {
          recentFiles: [
            {
              filePath: 'C:\\docs\\old.md',
              title: '47909249-b259-4466-830e-77afa39fb538',
              lastOpened: 1,
              pinned: false,
            },
          ],
        },
      })),
      preferencesSetOne: setOne,
      onPreferencesChanged: vi.fn(() => () => {}),
      setTheme: vi.fn(),
      setZoom: vi.fn(),
    })

    const store = usePreferencesStore()
    await store.loadPreferences()

    expect(store.recentFiles[0].title).toBe('old')
    expect(setOne).toHaveBeenCalledWith(
      'recentFiles',
      [expect.objectContaining({ filePath: 'C:\\docs\\old.md', title: 'old' })],
    )
  })
})
