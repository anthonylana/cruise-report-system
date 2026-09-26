import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// vite.config.ts runs in Node (not the browser), so process.env is available here.
// Docker Desktop on Windows doesn't forward file-change events from the Windows
// filesystem into the Linux container, so inside Docker we poll for changes instead.
const usePolling = process.env.WATCH_POLLING === 'true'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // listen on 0.0.0.0 so the port is reachable from outside the container
    port: 5173,
    strictPort: true,  // fail loudly instead of silently picking 5174
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
  },
})
