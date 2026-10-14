import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { startDocumentSync } from '../documentSync'
import { useTabsStore } from '@/stores/tabs'
import { Tab } from '@core/entities/Tab'

function createTabEntity(id = 'tab-1', content = 'initial'): Tab {
  return new Tab({
    id,
    title: 't.md',
    filePath: '/t.md',
    content,
    isDirty: false,
    viewMode: 'wysiwyg',
    splitRatio: 50,
    fileType: 'editor',
    createdAt: Date.now(),
    lastModified: Date.now(),
    lastSaved: null,
    crepe: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
    codeMirror: { cursor: { from: 0, to: 0 }, scrollTop: 0 },
  })
}

describe('startDocumentSync', () => {
  let store: ReturnType<typeof useTabsStore>
  let targets: {
    readVisible: () => string | null
    applyToWysiwyg: (content: string) => void
    applyToSource: (content: string) => void
    onAuthoritativeChange: (content: string) => void
  }
  let readVisible: ReturnType<typeof vi.fn<() => string | null>>
  let applyToWysiwyg: ReturnType<typeof vi.fn<(content: string) => void>>
  let applyToSource: ReturnType<typeof vi.fn<(content: string) => void>>
  let onAuthoritativeChange: ReturnType<typeof vi.fn<(content: string) => void>>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useTabsStore()
    store.insert(createTabEntity())
    readVisible = vi.fn<() => string | null>().mockReturnValue(null)
    applyToWysiwyg = vi.fn<(content: string) => void>()
    applyToSource = vi.fn<(content: string) => void>()
    onAuthoritativeChange = vi.fn<(content: string) => void>()
    targets = { readVisible, applyToWysiwyg, applyToSource, onAuthoritativeChange }
  })

  it('commit writes authority and broadcasts to both sides plus unified notify', async () => {
    const sync = startDocumentSync('tab-1', store, targets)

    const changed = sync.commit('# edited')

    expect(changed).toBe(true)
    expect(store.getById('tab-1')!.content).toBe('# edited')
    expect(store.getById('tab-1')!.isDirty).toBe(true)

    await nextTick()
    expect(applyToWysiwyg).toHaveBeenCalledWith('# edited')
    expect(applyToSource).toHaveBeenCalledWith('# edited')
    expect(onAuthoritativeChange).toHaveBeenCalledWith('# edited')

    sync.stop()
  })

  it('commit with identical content is a no-op', async () => {
    const sync = startDocumentSync('tab-1', store, targets)

    expect(sync.commit('initial')).toBe(false)

    await nextTick()
    expect(applyToWysiwyg).not.toHaveBeenCalled()
    expect(applyToSource).not.toHaveBeenCalled()

    sync.stop()
  })

  it('markDirty:false writes content without dirty flag (external reload semantics)', () => {
    const sync = startDocumentSync('tab-1', store, targets)

    sync.commit('reloaded from disk', { markDirty: false })

    expect(store.getById('tab-1')!.content).toBe('reloaded from disk')
    expect(store.getById('tab-1')!.isDirty).toBe(false)

    sync.stop()
  })

  it('direct store writes (search/replace etc.) also broadcast to both sides', async () => {
    const sync = startDocumentSync('tab-1', store, targets)

    // simulate useWorkspaceSearch / ReplaceInFile paths that bypass commit
    store.updateTab('tab-1', { content: 'replaced', isDirty: true })
    await nextTick()

    expect(applyToWysiwyg).toHaveBeenCalledWith('replaced')
    expect(applyToSource).toHaveBeenCalledWith('replaced')
    expect(onAuthoritativeChange).toHaveBeenCalledWith('replaced')

    sync.stop()
  })

  it('flush commits pending content from the visible editor', () => {
    const sync = startDocumentSync('tab-1', store, targets)
    readVisible.mockReturnValue('pending in visible editor')

    sync.flush()

    expect(store.getById('tab-1')!.content).toBe('pending in visible editor')
    expect(store.getById('tab-1')!.isDirty).toBe(true)

    sync.stop()
  })

  it('flush does nothing when visible editor is unavailable', () => {
    const sync = startDocumentSync('tab-1', store, targets)
    readVisible.mockReturnValue(null)

    sync.flush()

    expect(store.getById('tab-1')!.content).toBe('initial')

    sync.stop()
  })

  it('after stop, commit is rejected and watch no longer broadcasts', async () => {
    const sync = startDocumentSync('tab-1', store, targets)
    sync.stop()

    expect(sync.commit('x')).toBe(false)
    expect(store.getById('tab-1')!.content).toBe('initial')

    store.updateTab('tab-1', { content: 'y' })
    await nextTick()
    expect(applyToWysiwyg).not.toHaveBeenCalled()
    expect(applyToSource).not.toHaveBeenCalled()
  })
})
