import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1]
const isGithubActions = process.env.GITHUB_ACTIONS === 'true'
const base = isGithubActions && repoName ? `/${repoName}/` : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
