import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts'
      },
      preload: {
        input: 'electron/preload.ts',
        onstart({ reload }) {
          reload()
        }
      },
      renderer: {}
    }),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron-protocol': resolve(__dirname, 'electron-protocol')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;`
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Electron 42 = Chrome 120+，无需兼容旧浏览器
    target: 'chrome120',
    // 生产环境移除 console/debugger
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // 代码分割：将大型依赖拆分为独立 chunk（Vite 8 rolldown 使用函数签名）
        manualChunks(id: string) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vueuse')) {
            return 'vendor-vue'
          }
          if (id.includes('node_modules/@milkdown')) {
            return 'vendor-milkdown'
          }
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@uiw/codemirror')) {
            return 'vendor-codemirror'
          }
        }
      }
    }
  },
  esbuild: {
    // 生产环境移除 console.* 和 debugger 语句
    drop: command === 'build' ? ['console', 'debugger'] : []
  }
}))
