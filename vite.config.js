import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { devProxyConfig } from './vite.devProxy.js'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')   // all variables, not only VITE_ ones: DEV_FUNCTIONS_PROXY is read here and never reaches the browser
  return {
    plugins: [react()],
    server: { proxy: devProxyConfig(env) },       // undefined unless DEV_FUNCTIONS_PROXY=1; only the dev server reads it
    test: {
      environment: 'jsdom',
      globals: false,
      env: { VITE_TURNSTILE_SITE_KEY: '' },   // no CAPTCHA widget in the tests, unless a test turns it on on purpose
      include: ['src/**/*.test.{js,jsx}', 'tests/**/*.test.{js,jsx}', 'supabase/**/*.test.js'],
    },
  }
})
