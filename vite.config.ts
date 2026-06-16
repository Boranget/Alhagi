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
      // 多入口：主窗 (index.html) + 独立设置窗 (settings.html)
      // 两个 entry 共享 vendor chunk，但各自只加载自身需要的根组件链
      // —— 设置窗不会拖入 EditorContainer / Crepe / CodeMirror 这堆几 MB 的依赖。
      input: {
        index: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
      output: {
        // 代码分割：将大型依赖拆分为独立 chunk
        // 拆分原则：
        //   - vendor-vue：框架核心，首屏必需
        //   - vendor-milkdown-core：Crepe + commonmark/gfm preset，首屏必需
        //   - vendor-milkdown-features：math/prism/table 等独立 plugin，懒加载（被 Crepe 内部 dynamic import 触发）
        //   - vendor-codemirror-core：editor/view/state/commands，首屏必需（源码模式 + 代码块）
        //   - vendor-codemirror-langs：lang-* + language-data，按需加载
        //   - vendor-katex：KaTeX 公式渲染，仅含数学公式的文档需要
        //   - vendor-prism：Prism 语法高亮，仅源码模式/代码块需要
        manualChunks(id: string) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/pinia') || id.includes('node_modules/@vueuse')) {
            return 'vendor-vue'
          }
          // KaTeX 独立 chunk（含字体，由 CSS url() 自动处理）
          if (id.includes('node_modules/katex')) {
            return 'vendor-katex'
          }
          // Prism 独立（用于代码块 token 着色）
          if (id.includes('node_modules/prismjs') || id.includes('node_modules/refractor')) {
            return 'vendor-prism'
          }
          if (id.includes('node_modules/@milkdown')) {
            // math/prism/table/listener 等独立 plugin → features chunk
            // 主要由 Crepe 内部 dynamic import，拆出来不影响首屏阻塞
            if (
              id.includes('@milkdown/plugin-math') ||
              id.includes('@milkdown/plugin-prism') ||
              id.includes('@milkdown/plugin-listener') ||
              id.includes('@milkdown/plugin-clipboard') ||
              id.includes('@milkdown/plugin-block') ||
              id.includes('@milkdown/plugin-tooltip') ||
              id.includes('@milkdown/plugin-slash') ||
              id.includes('@milkdown/plugin-cursor')
            ) {
              return 'vendor-milkdown-features'
            }
            return 'vendor-milkdown-core'
          }
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@uiw/codemirror')) {
            // 语言包独立 chunk：触发它的代码块/源码模式才加载
            if (id.includes('@codemirror/lang-') || id.includes('@codemirror/language-data')) {
              return 'vendor-codemirror-langs'
            }
            return 'vendor-codemirror-core'
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
