import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Fail loudly instead of sliding to 5174 when the port is taken. The API's
    // APP_URL names 5173 as where Xendit returns the guest after paying, so a
    // silent port change sends them to a dead address.
    strictPort: true,
    // Open a browser tab on `npm run dev`.
    open: true,
  },
})
