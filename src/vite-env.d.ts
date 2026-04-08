/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LINKEDIN_CLIENT_ID: string
  readonly VITE_LINKEDIN_REDIRECT_URI: string
  readonly VITE_LINKEDIN_AUTH_FUNCTION_URL: string
  readonly VITE_LINKEDIN_SYNC_URL: string
  readonly VITE_MONDAY_CLIENT_ID: string
  readonly VITE_MONDAY_AUTH_FUNCTION_URL: string
  readonly VITE_DEMO_MODE: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

