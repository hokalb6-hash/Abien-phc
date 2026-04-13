/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 1 = نطق عبر Supabase Edge + Google TTS (مُستحسن لشاشات التلفاز) */
  readonly VITE_USE_EDGE_TTS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
