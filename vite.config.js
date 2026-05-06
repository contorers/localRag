import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      entry: 'electron/main.js',
      vite: {
        build: {
          rollupOptions: {
            external: ['electron'],
            output: {
              // 🌟 强力补充：显式要求输出为 ESM 格式
              // 这样可以防止打包工具自动插入 require('path') 等代码
              format: 'esm', 
            },
          },
        },
      },
    }),
    renderer(),
  ],
  base: './', // ✅ 正确：Electron 必须使用相对路径
})