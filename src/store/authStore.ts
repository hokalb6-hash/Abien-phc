import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { STAFF_GATE_STORAGE_KEY } from '../constants/staffGate'
import { supabase } from '../lib/supabase'
import type { AppRole, Profile } from '../types/db'

type AuthListener = {
  data: { subscription: { unsubscribe: () => void } }
}

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: AppRole | null
  loading: boolean
  initialized: boolean
  /** تهيئة الاشتراك في تغيّر الجلسة (مرة واحدة من جذر التطبيق) */
  init: () => void
  /** جلب صف الملف الشخصي المرتبط بالمستخدم الحالي */
  fetchProfile: (userId: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  clear: () => void
}

let authListener: AuthListener | null = null
/** يمنع تكرار التهيئة مع React Strict Mode ويضمن اشتراك auth مرة واحدة */
let authModuleInitStarted = false

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: false,
  initialized: false,

  init: () => {
    if (authModuleInitStarted) return
    authModuleInitStarted = true

    authListener = supabase.auth.onAuthStateChange((event, session) => {
      // الجلسة الأولى تُحمَّل عبر getSession في الكتلة أدناه لتفادي سباق وتعلّق loading
      if (event === 'INITIAL_SESSION') return

      set({
        session,
        user: session?.user ?? null,
        loading: true,
      })
      if (session?.user) {
        void get()
          .fetchProfile(session.user.id)
          .finally(() => set({ loading: false }))
      } else {
        set({ profile: null, role: null, loading: false })
      }
    })

    void (async () => {
      set({ loading: true })
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        const session = data.session
        set({ session, user: session?.user ?? null })
        if (session?.user) {
          await get().fetchProfile(session.user.id)
        } else {
          set({ profile: null, role: null })
        }
      } catch (e) {
        console.error('فشل تهيئة الجلسة:', e)
        set({
          user: null,
          session: null,
          profile: null,
          role: null,
        })
      } finally {
        set({ loading: false, initialized: true })
      }
    })()
  },

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('فشل جلب الملف الشخصي:', error.message)
      set({ profile: null, role: null })
      return
    }

    if (!data) {
      set({ profile: null, role: null })
      return
    }

    set({
      profile: data,
      role: data.role,
    })
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true })
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) {
      set({ loading: false })
      return { error: new Error(error.message) }
    }
    if (data.user) {
      await get().fetchProfile(data.user.id)
    }
    set({ loading: false })
    return { error: null }
  },

  signOut: async () => {
    set({ loading: true })
    await supabase.auth.signOut()
    try {
      sessionStorage.removeItem(STAFF_GATE_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    set({
      user: null,
      session: null,
      profile: null,
      role: null,
      loading: false,
    })
  },

  clear: () => {
    authListener?.data.subscription.unsubscribe()
    authListener = null
    authModuleInitStarted = false
    set({
      user: null,
      session: null,
      profile: null,
      role: null,
      loading: false,
      initialized: false,
    })
  },
}))

/** مسار افتراضي بعد تسجيل الدخول حسب الدور */
export function defaultPathForRole(role: AppRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin'
    case 'reception':
      /** دور الاستقبال لم يعد مستخدماً في الواجهة؛ حدّث الدور في Supabase أو استخدم صفحة التسجيل الذاتي */
      return '/check-in'
    case 'clinic':
      return '/clinic'
    case 'lab':
      return '/lab'
    case 'er':
      return '/er'
    case 'pharmacy':
      return '/pharmacy'
    case 'display':
      return '/display'
    default:
      return '/login'
  }
}
