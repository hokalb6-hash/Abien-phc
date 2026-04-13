import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/db'

/**
 * عميل مؤقت بدون حفظ الجلسة في localStorage — لاستدعاء signUp من لوحة الأدمن
 * دون أن يُستبدل حساب المدير الحالي في المتصفح.
 */
export function createEphemeralSupabaseClient() {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
  }

  const url = import.meta.env.VITE_SUPABASE_URL
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

  return createClient<Database>(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: memoryStorage,
    },
  })
}
