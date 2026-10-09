// Dev only: run the app on localhost against the REAL Supabase project without changing the project's CORS secret.
// The browser talks to /sbproxy on localhost (same origin), and this proxy forwards to Supabase from the server side with
// the Origin header removed, so the Edge Functions' ALLOWED_ORIGINS list (production domains only) is not involved.
//
//   PROXY_TARGET=https://<project-ref>.supabase.co VITE_SUPABASE_URL=http://localhost:5173/sbproxy \
//     npx vite --mode production --config scripts/vite.dev-proxy.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sbproxy': {
        target: process.env.PROXY_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sbproxy/, ''),
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
});
