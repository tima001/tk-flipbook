import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps all asset paths relative, so the build works whether it is
// served from a custom domain root (tkholding.kz) or a project subpath
// (username.github.io/repo-name/). No changes needed when you connect the domain.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    assetsInlineLimit: 0,
  },
})
