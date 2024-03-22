import { resolve } from 'path'

export default {
  root: resolve(__dirname, 'src'),
  publicDir: 'public',
  build: {
    emptyOutDir: true,
    outDir: '../dist'
  },
  server: {
    port: 8080
  }
}