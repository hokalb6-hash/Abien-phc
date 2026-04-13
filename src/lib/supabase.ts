import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/db'

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * createClient يرمي خطأ متزامناً إذا كان الرابط فارغاً — فيتعطّل التطبيق بالكامل (شاشة بيضاء).
 * لذلك نستخدم قيماً وهمية تمرّر التحقق حتى تُحمَّل الواجهة؛ لن تعمل طلبات حقيقية حتى تضع .env الصحيح.
 */
const FALLBACK_URL = 'https://placeholder.supabase.co'
/** مفتاح anon تجريبي (تنسيق JWT صالح) — ليس لمشروعك */
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk1NzM0NTIwMH0.DaYlNEoUrrEn2Ig1tq6S_3-5kDRTZhEOGTHkxx3WwjE'

export const isSupabaseConfigured = Boolean(rawUrl && rawKey)

const supabaseUrl = rawUrl || FALLBACK_URL
const supabaseAnonKey = rawKey || FALLBACK_ANON_KEY

if (!isSupabaseConfigured) {
  console.warn(
    '[أبين الصحي] لم تُضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في .env — الواجهة تعمل للمعاينة فقط؛ الحجز والدخول لن ينجحا حتى تضيف مفاتيح مشروعك.',
  )
}

/**
 * عميل Supabase موثّق بأنواع الجداول (Database).
 * الوصول الفعلي يخضع لسياسات RLS في المشروع.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
    /** مهلة أطول تقلّل TIMED_OUT الوهمي على الشبكات البطيئة أو عند أول اتصال */
    timeout: 25_000,
  },
})
