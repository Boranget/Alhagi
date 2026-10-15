import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@adapters': resolve(__dirname, 'src/adapters'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@electron-protocol': resolve(__dirname, 'electron-protocol'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    // happy-dom 每文件创建耗时占全量测试 ~80%（44 文件 ≈ 77s 环境时间）。
    // vmThreads：每个 worker 复用同一个 happy-dom 实例，保留按文件隔离。
    pool: 'vmThreads',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
})
