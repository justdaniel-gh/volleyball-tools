import { resolve } from 'path'

export default {
  root: resolve(__dirname, 'src'),
  publicDir: 'public',
  build: {
    emptyOutDir: true,
    outDir: '../dist'
  },
  base: '/volleyball-tools/',
  server: {
    port: 8080
  }
}