import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    // Proxy all API routes to the backend using 127.0.0.1 (IPv4) to avoid
    // Chromium's localhost→::1 (IPv6) resolution hitting the wrong interface.
    // Browser code uses relative URLs (API_BASE='') so requests stay same-origin
    // and Vite proxies them here — no CORS, no SameSite cookie issues.
    proxy: {
      '/auth':      'http://127.0.0.1:3001',
      '/courses':   'http://127.0.0.1:3001',
      '/assets':    'http://127.0.0.1:3001',
      '/health':    'http://127.0.0.1:3001',
      '/telemetry': 'http://127.0.0.1:3001',
    },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    // Vite 5 falls back to server.proxy when preview.proxy is unset.
    // server.proxy includes '/assets' → backend, which intercepts the built
    // JS/CSS bundle at /assets/index-*.js returning 401 from the API.
    // The built app uses VITE_API_URL (absolute URL) so no proxying is needed.
    proxy: {},
  },
  build: {
    outDir: 'dist',
  },
})
