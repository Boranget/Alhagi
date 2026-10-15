import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  detectDescriptor,
  getDescriptor,
  listDescriptors,
  getRegisteredIds,
  type FileTypeDescriptor,
} from '../index'

/**
 * registry 契约测试（方案 D 第 3a 步）。
 *
 * EditorContainer 的渲染分支完全由 descriptor 形状驱动：
 *   useEditorShell = (descriptor.viewer === null)
 *   canSave → model-value 绑定 + handleViewerChange 写回 store
 *
 * 这些断言焊死形状契约，防止 descriptor 改动悄悄破坏分支
 * （如 txt 回归：viewer 被移除 + 硬编码 md-only 导致非 markdown 丢失编辑能力）。
 */

const byId = (id: string): FileTypeDescriptor => {
  const d = getDescriptor(id)
  expect(d, `descriptor '${id}' 未注册`).toBeDefined()
  return d!
}

describe('fileTypes registry 契约', () => {
  describe('descriptor 形状（EditorContainer 渲染分支的依赖）', () => {
    it("viewer===null 的 descriptor 恰好只有 'editor'", () => {
      const nullViewerIds = listDescriptors()
        .filter((d) => d.viewer === null)
        .map((d) => d.id)
      expect(nullViewerIds).toEqual(['editor'])
    })

    it("canSave=true 的 descriptor 全部 loadStrategy='utf8'（保存从 tab.content 取内容）", () => {
      const savers = listDescriptors().filter((d) => d.canSave)
      expect(savers.length).toBeGreaterThan(0)
      for (const d of savers) {
        expect(d.loadStrategy, `${d.id} canSave=true 但 loadStrategy=${d.loadStrategy}`).toBe('utf8')
      }
    })

    it('canSave=true：要么走主编辑器（editor），要么有 viewer（model-value 绑定对象）', () => {
      for (const d of listDescriptors().filter((x) => x.canSave)) {
        const ok = d.id === 'editor' || d.viewer !== null
        expect(ok, `${d.id} canSave=true 但既非 editor 也无 viewer`).toBe(true)
      }
    })

    it("fallback 是 'unsupported' 且 extensions 为空数组", () => {
      const fb = detectDescriptor('/x/unknown.xyz')
      expect(fb.id).toBe('unsupported')
      expect(fb.extensions).toEqual([])
      expect(fb.canSave).toBe(false)
    })

    it("editor 扩展名为 .md 系，canSave=true", () => {
      const editor = byId('editor')
      expect(editor.extensions).toEqual(['.md', '.markdown', '.mdown', '.mkd', '.mkdn'])
      expect(editor.canSave).toBe(true)
      expect(editor.loadStrategy).toBe('utf8')
    })

    it('所有扩展名以 . 开头且为小写', () => {
      for (const d of listDescriptors()) {
        for (const ext of d.extensions) {
          expect(ext.startsWith('.'), `${d.id} → '${ext}' 不以 . 开头`).toBe(true)
          expect(ext, `${d.id} → '${ext}' 含大写`).toBe(ext.toLowerCase())
        }
      }
    })
  })

  describe('detectDescriptor', () => {
    it('null 路径 → editor（欢迎页让 Crepe 挂载占位）', () => {
      expect(detectDescriptor(null).id).toBe('editor')
      expect(detectDescriptor('').id).toBe('editor')
    })

    it('markdown 扩展名全列表 → editor', () => {
      for (const ext of byId('editor').extensions) {
        expect(detectDescriptor(`/docs/file${ext}`).id, ext).toBe('editor')
      }
    })

    it('扩展名大小写不敏感', () => {
      expect(detectDescriptor('/docs/README.MD').id).toBe('editor')
      expect(detectDescriptor('/img/LOGO.PNG').id).toBe('image')
    })

    it('text 扩展名全列表 → text', () => {
      for (const ext of byId('text').extensions) {
        expect(detectDescriptor(`/docs/file${ext}`).id, ext).toBe('text')
      }
    })

    it('全名扩展（.gitignore / .editorconfig）→ text', () => {
      expect(detectDescriptor('/repo/.gitignore').id).toBe('text')
      expect(detectDescriptor('/repo/.editorconfig').id).toBe('text')
    })

    it('image 扩展名全列表 → image', () => {
      for (const ext of byId('image').extensions) {
        expect(detectDescriptor(`/img/photo${ext}`).id, ext).toBe('image')
      }
    })

    it('未知扩展名 / 无扩展名 / 纯文件名 → unsupported', () => {
      expect(detectDescriptor('/a/b.unknownext').id).toBe('unsupported')
      expect(detectDescriptor('/a/Dockerfile').id).toBe('unsupported')
      expect(detectDescriptor('/a/Makefile').id).toBe('unsupported')
    })

    it('Windows 路径分隔符同样解析', () => {
      expect(detectDescriptor('C:\\Users\\me\\notes.txt').id).toBe('text')
      expect(detectDescriptor('C:\\Users\\me\\doc.md').id).toBe('editor')
    })
  })

  describe('getDescriptor（tab.fileType 查表）', () => {
    it('四个内置 id 均可查到（EditorContainer getDescriptor(tab.fileType) 链路）', () => {
      for (const id of ['editor', 'text', 'image', 'unsupported']) {
        expect(getDescriptor(id)?.id, id).toBe(id)
      }
    })

    it('未知 fileType id → undefined（回落到 detectDescriptor）', () => {
      expect(getDescriptor('pdf')).toBeUndefined()
    })

    it('getRegisteredIds 与 listDescriptors 一致', () => {
      expect(getRegisteredIds().sort()).toEqual(listDescriptors().map((d) => d.id).sort())
    })
  })

  describe('注册守卫（模块隔离的干净 registry）', () => {
    afterEach(() => {
      vi.resetModules()
    })

    async function freshRegistry() {
      vi.resetModules()
      return await import('../registry')
    }

    it('重复 id 抛错', async () => {
      const r = await freshRegistry()
      const base: FileTypeDescriptor = {
        id: 'dup', displayName: 'Dup', extensions: ['.a'], loadStrategy: 'utf8',
        canSave: true, defaultExtension: '', viewer: null,
      }
      r.registerFileType(base)
      expect(() => r.registerFileType({ ...base })).toThrow(/duplicate descriptor id/)
    })

    it('扩展名冲突抛错', async () => {
      const r = await freshRegistry()
      r.registerFileType({
        id: 'one', displayName: 'One', extensions: ['.shared'], loadStrategy: 'utf8',
        canSave: true, defaultExtension: '', viewer: null,
      })
      expect(() => r.registerFileType({
        id: 'two', displayName: 'Two', extensions: ['.shared'], loadStrategy: 'utf8',
        canSave: true, defaultExtension: '', viewer: null,
      })).toThrow(/already owned by 'one'/)
    })

    it('双 fallback 抛错', async () => {
      const r = await freshRegistry()
      const d = (id: string): FileTypeDescriptor => ({
        id, displayName: id, extensions: [], loadStrategy: 'none',
        canSave: false, defaultExtension: '', viewer: null,
      })
      r.registerFileType(d('fb1'), true)
      expect(() => r.registerFileType(d('fb2'), true)).toThrow(/only one fallback/)
    })

    it("扩展名不以 '.' 开头抛错", async () => {
      const r = await freshRegistry()
      expect(() => r.registerFileType({
        id: 'bad', displayName: 'Bad', extensions: ['md'], loadStrategy: 'utf8',
        canSave: true, defaultExtension: '', viewer: null,
      })).toThrow(/must start with/)
    })

    it('无 fallback 时 detectDescriptor 抛错', async () => {
      const r = await freshRegistry()
      r.registerFileType({
        id: 'only', displayName: 'Only', extensions: ['.only'], loadStrategy: 'utf8',
        canSave: true, defaultExtension: '', viewer: null,
      })
      expect(() => r.detectDescriptor('/x/other.bin')).toThrow(/no fallback/)
    })
  })
})
