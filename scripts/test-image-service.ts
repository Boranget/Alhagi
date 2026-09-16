import { ImageInsertService } from '../src/services/image/ImageInsertService'
import { ImageSource } from '../src/core/entities/image/ImageSource'
import { ImageInsertOptions } from '../src/core/entities/image/ImageInsertOptions'
import { ImageStorageGateway } from '../src/adapters/gateways/image/ImageStorageGateway'
import type { IFileSystem } from '../src/core/interfaces/gateways/IFileSystem'
import type { ImageInsertContext } from '../src/core/interfaces/services/image/IImageInsertStrategy'

// Mock FileSystem for testing
const createMockFileSystem = (): IFileSystem => ({
  readFile: async () => '',
  readBinary: async () => ({ data: '', mimeType: 'image/png' }),
  writeFile: async () => {},
  writeBinary: async () => {},
  exists: async () => true,
  existsBatch: async () => [],
  mkdir: async () => {},
  readdir: async () => [],
  stat: async () => ({ isDirectory: false, size: 0, lastModified: 0 }),
  rename: async () => {},
  delete: async () => {},
  copy: async () => {},
  move: async () => {},
  ensureDirectory: async () => {},
  showInFolder: async () => {},
  getDocumentsDirectory: async () => 'D:/Users/Documents',
})

// Test runner
async function runTests() {
  console.log('=== ImageInsertService Integration Test ===\n')

  const mockFS = createMockFileSystem()
  const imageStorage = new ImageStorageGateway(mockFS)
  const service = new ImageInsertService(imageStorage)

  let pass = 0
  let fail = 0

  function assert(name: string, condition: boolean, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${name}`)
      pass++
    } else {
      console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`)
      fail++
    }
  }

  // Test 1: Keep Original Mode
  console.log('\n── Test 1: Keep Original Mode ──')
  {
    const context: ImageInsertContext = {
      currentFilePath: 'D:/projects/notes/readme.md',
      currentFileDir: 'D:/projects/notes',
      editorInsertImage: (url, alt) => {
        assert('editorInsertImage called with correct URL', url === '/images/photo.png', `got: ${url}`)
        assert('editorInsertImage called with correct alt', alt === 'photo.png', `got: ${alt}`)
      },
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'keep-original' })

    const result = await service.insert(source, options)
    assert('Keep original returns success', result.success === true)
    assert('Keep original returns original URL', result.imageUrl === '/images/photo.png')
  }

  // Test 2: Copy Mode with Relative Path
  console.log('\n── Test 2: Copy Mode with Relative Path ──')
  {
    const context: ImageInsertContext = {
      currentFilePath: 'D:/projects/notes/readme.md',
      currentFileDir: 'D:/projects/notes',
      editorInsertImage: (url, alt) => {
        assert('Copy mode uses relative path', url.startsWith('./'), `got: ${url}`)
        assert('Copy mode preserves filename', url.includes('clipboard-image.png'), `got: ${url}`)
      },
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'clipboard-image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './images/',
      preferRelativePath: true,
    })

    const result = await service.insert(source, options)
    assert('Copy mode returns success', result.success === true)
  }

  // Test 3: Copy Mode with Path Template
  console.log('\n── Test 3: Copy Mode with Path Template ──')
  {
    const context: ImageInsertContext = {
      currentFilePath: 'D:/projects/notes/readme.md',
      currentFileDir: 'D:/projects/notes',
      editorInsertImage: (url, alt) => {
        assert('Template expands {filename}', url.includes('readme.assets'), `got: ${url}`)
      },
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'clipboard',
      data: 'base64data',
      fileName: 'image.png',
      mimeType: 'image/png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      copyPath: './{filename}.assets/',
    })

    const result = await service.insert(source, options)
    assert('Template expansion returns success', result.success === true)
  }

  // Test 4: Skip Local Images
  console.log('\n── Test 4: Skip Local Images ──')
  {
    const context: ImageInsertContext = {
      currentFilePath: 'D:/projects/notes/readme.md',
      currentFileDir: 'D:/projects/notes',
      editorInsertImage: () => {
        assert('editorInsertImage should not be called for skipped images', false)
      },
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({
      mode: 'copy',
      applyToLocal: false,
    })

    const result = await service.insert(source, options)
    assert('Skip local returns original URL', result.imageUrl === '/images/photo.png')
  }

  // Test 5: URL Escape
  console.log('\n── Test 5: URL Escape ──')
  {
    const context: ImageInsertContext = {
      currentFilePath: 'D:/projects/notes/readme.md',
      currentFileDir: 'D:/projects/notes',
      editorInsertImage: (url, alt) => {
        assert('URL is escaped', url.includes('%20'), `got: ${url}`)
      },
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'file',
      data: '/images/photo (1).png',
      fileName: 'photo (1).png',
    })
    const options = new ImageInsertOptions({
      mode: 'keep-original',
      escapeUrl: true,
    })

    const result = await service.insert(source, options)
    assert('Escape URL returns success', result.success === true)
  }

  // Test 6: Unknown Mode
  console.log('\n── Test 6: Unknown Mode ──')
  {
    const context: ImageInsertContext = {
      editorInsertImage: () => {},
    }
    service.setContextProvider(() => context)

    const source = new ImageSource({
      type: 'file',
      data: '/images/photo.png',
      fileName: 'photo.png',
    })
    const options = new ImageInsertOptions({ mode: 'unknown' as any })

    const result = await service.insert(source, options)
    assert('Unknown mode returns failure', result.success === false)
    assert('Unknown mode has error message', result.error?.includes('Unknown insert mode') ?? false)
  }

  // Summary
  console.log('\n=== Test Summary ===')
  console.log(`Passed: ${pass}`)
  console.log(`Failed: ${fail}`)
  console.log(`Total: ${pass + fail}`)

  process.exit(fail > 0 ? 1 : 0)
}

runTests().catch(console.error)
