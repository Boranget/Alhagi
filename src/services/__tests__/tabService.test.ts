import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { TabService } from '../tabService'
import { useTabsStore } from '../../stores/tabs'
import type { TabState } from '@/types'

const mocks = vi.hoisted(() => ({
  saveFile: vi.fn<() => Promise<{ success: boolean; data?: string }>>(),
  saveAsFile: vi.fn<() => Promise<{ success: boolean; data?: string }>>(),
  getMarkdown: vi.fn<() => string>(),
  prefs: { lineEnding: 'lf', addRecentFile: vi.fn() },
}))

vi.mock('@/services/electron/ElectronService', () => ({
  electronService: {
    isAvailable: () => true,
    saveFile: mocks.saveFile,
    saveAsFile: mocks.saveAsFile,
  },
}))

vi.mock('@adapters/gateways/EditorServiceGateway', () => ({
  getEditorServiceGateway: () => ({ getMarkdown: mocks.getMarkdown }),
}))

vi.mock('@/stores/preferences', () => ({
  usePreferencesStore: () => mocks.prefs,
}))

vi.mock('@/composables/useTabActions', () => ({
  useTabActions: () => ({ createTab: vi.fn() }),
}))

vi.mock('@/utils/tempImageManager', () => ({
  copyTempImagesToTarget: vi.fn(async () => {}),
  deleteTempImageDir: vi.fn(async () => {}),
}))

function makeTab(overrides: Partial<TabState>): TabState {
  return {
    id: 'a',
    filePath: '/docs/a.md',
    content: 'v1',
    isDirty: true,
    title: 'a.md',
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'markdown',
    createdAt: 0,
    lastModified: 0,
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    ...overrides,
  }
}

describe('TabService saveFile 保存往返竞态', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.saveFile.mockReset().mockResolvedValue({ success: true })
    mocks.saveAsFile.mockReset().mockResolvedValue({ success: true, data: '/docs/new.md' })
    mocks.getMarkdown.mockReset().mockReturnValue('v1')
    mocks.prefs.addRecentFile.mockClear()
  })

  // 核心回归：保存 IPC 往返期间用户继续敲键（commit 置 dirty、content 变为
  // 'v2'），落盘的仍是快照 'v1'——绝不能无条件 markClean，否则关闭无提示、
  // 自动保存被 !isDirty 跳过，敲的键只存在于内存。
  it('往返期间敲键：保持 dirty，不被快照清位', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', isDirty: true }))
    mocks.saveFile.mockImplementation(async () => {
      store.updateTab('a', { content: 'v2' })
      return { success: true }
    })

    const ok = await new TabService().saveFile('a')

    expect(ok).toBe(true)
    expect(store.getTab('a')?.isDirty).toBe(true)
    expect(mocks.saveFile).toHaveBeenCalledWith('/docs/a.md', 'v1', 'lf')
  })

  it('往返期间无新编辑：正常清 dirty', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', isDirty: true }))

    const ok = await new TabService().saveFile('a')

    expect(ok).toBe(true)
    expect(store.getTab('a')?.isDirty).toBe(false)
    expect(store.getTab('a')?.lastSaved).not.toBeNull()
  })

  it('落盘失败：不清位', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', isDirty: true }))
    mocks.saveFile.mockResolvedValue({ success: false })

    const ok = await new TabService().saveFile('a')

    expect(ok).toBe(false)
    expect(store.getTab('a')?.isDirty).toBe(true)
  })

  it('saveFileAs 同样只在内容未变时清位', async () => {
    const store = useTabsStore()
    store.addTab(makeTab({ id: 'a', filePath: null, isDirty: true }))
    mocks.saveAsFile.mockImplementation(async () => {
      store.updateTab('a', { content: 'v2' })
      return { success: true, data: '/docs/new.md' }
    })

    const ok = await new TabService().saveFile('a')

    expect(ok).toBe(true)
    expect(store.getTab('a')?.filePath).toBe('/docs/new.md')
    expect(store.getTab('a')?.isDirty).toBe(true)
  })
})
