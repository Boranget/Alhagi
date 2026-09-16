import { ImageInsertService } from '../src/services/image/ImageInsertService'
import { ImageSource } from '../src/core/entities/image/ImageSource'
import { ImageInsertOptions } from '../src/core/entities/image/ImageInsertOptions'
import { ImageStorageGateway } from '../src/adapters/gateways/image/ImageStorageGateway'
import type { IFileSystem } from '../src/core/interfaces/gateways/IFileSystem'
import type { ImageInsertContext } from '../src/core/interfaces/services/image/IImageInsertStrategy'

// Track all operations for verification
const operations: string[] = []

// Mock FileSystem with operation tracking
const createMockFileSystem = (): IFileSystem => ({
  readFile: async (path: string) => {
    operations.push(`readFile: ${path}`)
    return ''
  },
  readBinary: async (path: string) => {
    operations.push(`readBinary: ${path}`)
    return { data: 'base64data', mimeType: 'image/png' }
  },
  writeFile: async (path: string) => {
    operations.push(`writeFile: ${path}`)
  },
  writeBinary: async (path: string) => {
    operations.push(`writeBinary: ${path}`)
  },
  exists: async () => true,
  existsBatch: async () => [],
  mkdir: async (path: string) => {
    operations.push(`mkdir: ${path}`)
  },
  readdir: async () => [],
  stat: async () => ({ isDirectory: false, size: 0, lastModified: 0 }),
  rename: async () => {},
  delete: async () => {},
  copy: async () => {},
  move: async () => {},
  ensureDirectory: async (path: string) => {
    operations.push(`ensureDirectory: ${path}`)
  },
  showInFolder: async () => {},
  getDocumentsDirectory: async () => 'D:/Users/Documents',
})

// Test scenarios
const scenarios = [
  {
    name: 'Scenario 1: Paste clipboard image to document folder',
    setup: () => ({
      source: new ImageSource({
        type: 'clipboard',
        data: 'base64_screenshot_data',
        fileName: 'screenshot.png',
        mimeType: 'image/png',
      }),
      options: new ImageInsertOptions({
        mode: 'copy',
        copyPath: './images/',
        preferRelativePath: true,
      }),
      context: {
        currentFilePath: 'D:/projects/notes/meeting.md',
        currentFileDir: 'D:/projects/notes',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: true,
      shouldSaveFile: true,
      shouldInsertImage: true,
      urlPattern: /\.\/images\/screenshot\.png/,
    },
  },
  {
    name: 'Scenario 2: Paste image with filename template',
    setup: () => ({
      source: new ImageSource({
        type: 'clipboard',
        data: 'base64_image_data',
        fileName: 'photo.png',
        mimeType: 'image/png',
      }),
      options: new ImageInsertOptions({
        mode: 'copy',
        copyPath: './{filename}.assets/',
        preferRelativePath: true,
      }),
      context: {
        currentFilePath: 'D:/projects/docs/readme.md',
        currentFileDir: 'D:/projects/docs',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: true,
      shouldSaveFile: true,
      shouldInsertImage: true,
      urlPattern: /\.\/readme\.assets\/photo\.png/,
    },
  },
  {
    name: 'Scenario 3: Keep original local file',
    setup: () => ({
      source: new ImageSource({
        type: 'file',
        data: 'D:/photos/vacation.jpg',
        fileName: 'vacation.jpg',
      }),
      options: new ImageInsertOptions({
        mode: 'keep-original',
      }),
      context: {
        currentFilePath: 'D:/projects/notes/travel.md',
        currentFileDir: 'D:/projects/notes',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: false,
      shouldSaveFile: false,
      shouldInsertImage: true,
      urlPattern: /D:\/photos\/vacation\.jpg/,
    },
  },
  {
    name: 'Scenario 4: Skip local image with applyToLocal=false',
    setup: () => ({
      source: new ImageSource({
        type: 'file',
        data: 'D:/photos/local.jpg',
        fileName: 'local.jpg',
      }),
      options: new ImageInsertOptions({
        mode: 'copy',
        applyToLocal: false,
      }),
      context: {
        currentFilePath: 'D:/projects/notes/doc.md',
        currentFileDir: 'D:/projects/notes',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: false,
      shouldSaveFile: false,
      shouldInsertImage: true,
      urlPattern: /D:\/photos\/local\.jpg/,
    },
  },
  {
    name: 'Scenario 5: Copy remote image with applyToRemote=false',
    setup: () => ({
      source: new ImageSource({
        type: 'url',
        data: 'https://example.com/image.png',
        fileName: 'remote.png',
      }),
      options: new ImageInsertOptions({
        mode: 'copy',
        applyToRemote: false,
      }),
      context: {
        currentFilePath: 'D:/projects/notes/doc.md',
        currentFileDir: 'D:/projects/notes',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: false,
      shouldSaveFile: false,
      shouldInsertImage: true,
      urlPattern: /https:\/\/example\.com\/image\.png/,
    },
  },
  {
    name: 'Scenario 6: Escape URL with special characters',
    setup: () => ({
      source: new ImageSource({
        type: 'file',
        data: 'D:/my photos/photo (1).jpg',
        fileName: 'photo (1).jpg',
      }),
      options: new ImageInsertOptions({
        mode: 'keep-original',
        escapeUrl: true,
      }),
      context: {
        currentFilePath: 'D:/projects/notes/doc.md',
        currentFileDir: 'D:/projects/notes',
        editorInsertImage: (url: string, alt: string) => {
          operations.push(`editorInsertImage: ${url} (${alt})`)
        },
      } as ImageInsertContext,
    }),
    expected: {
      success: true,
      shouldCreateDir: false,
      shouldSaveFile: false,
      shouldInsertImage: true,
      urlPattern: /D:\/my%20photos\/photo%20%281%29\.jpg/,
    },
  },
]

// Run tests
async function runTests() {
  console.log('=== End-to-End Image Insertion Test ===\n')

  const mockFS = createMockFileSystem()
  const imageStorage = new ImageStorageGateway(mockFS)
  const service = new ImageInsertService(imageStorage)

  let pass = 0
  let fail = 0

  for (const scenario of scenarios) {
    console.log(`\n── ${scenario.name} ──`)
    operations.length = 0 // Clear operations

    const { source, options, context } = scenario.setup()
    service.setContextProvider(() => context)

    const result = await service.insert(source, options)

    // Verify results
    const assert = (name: string, condition: boolean, detail?: string) => {
      if (condition) {
        console.log(`  ✓ ${name}`)
        pass++
      } else {
        console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ''}`)
        fail++
      }
    }

    assert('Returns expected success', result.success === scenario.expected.success)

    if (scenario.expected.shouldCreateDir) {
      assert('Creates directory', operations.some(op => op.startsWith('ensureDirectory:')))
    } else {
      assert('Does not create directory', !operations.some(op => op.startsWith('ensureDirectory:')))
    }

    if (scenario.expected.shouldSaveFile) {
      assert('Saves file', operations.some(op => op.startsWith('writeBinary:')))
    } else {
      assert('Does not save file', !operations.some(op => op.startsWith('writeBinary:')))
    }

    if (scenario.expected.shouldInsertImage) {
      assert('Inserts image', operations.some(op => op.startsWith('editorInsertImage:')))
      const insertOp = operations.find(op => op.startsWith('editorInsertImage:'))
      if (insertOp) {
        const url = insertOp.split(': ')[1].split(' (')[0]
        assert('URL matches pattern', scenario.expected.urlPattern.test(url), url)
      }
    }
  }

  // Summary
  console.log('\n=== Test Summary ===')
  console.log(`Passed: ${pass}`)
  console.log(`Failed: ${fail}`)
  console.log(`Total: ${pass + fail}`)

  process.exit(fail > 0 ? 1 : 0)
}

runTests().catch(console.error)
