import { isSupabaseConfigured, supabase } from './supabase'

let currentAudio: HTMLAudioElement | null = null
let currentObjectUrl: string | null = null

export function stopEdgeTtsPlayback(): void {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.removeAttribute('src')
      currentAudio.load()
    } catch {
      /* ignore */
    }
    currentAudio = null
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl)
    } catch {
      /* ignore */
    }
    currentObjectUrl = null
  }
}

export function edgeTtsEnabled(): boolean {
  return String(import.meta.env.VITE_USE_EDGE_TTS ?? '').trim() === '1' && isSupabaseConfigured
}

function playMp3FromBase64(base64: string): Promise<void> {
  stopEdgeTtsPlayback()
  return new Promise((resolve, reject) => {
    try {
      const bin = atob(base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      currentObjectUrl = url
      const a = new Audio(url)
      currentAudio = a
      const cleanup = () => {
        stopEdgeTtsPlayback()
      }
      a.onended = () => {
        cleanup()
        resolve()
      }
      a.onerror = () => {
        cleanup()
        reject(new Error('audio playback error'))
      }
      void a.play().catch((e) => {
        cleanup()
        reject(e)
      })
    } catch (e) {
      stopEdgeTtsPlayback()
      reject(e)
    }
  })
}

export type EdgeTtsPlayResult =
  | { ok: true }
  | { ok: false; message: string }

function formatInvokeFailure(error: unknown, data: unknown): string {
  if (error != null && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const msg = typeof e.message === 'string' ? e.message.trim() : ''
    const ctx = e.context as Record<string, unknown> | undefined
    const body = ctx && typeof ctx.body === 'string' ? ctx.body : ''
    if (body) {
      try {
        const j = JSON.parse(body) as { error?: unknown }
        if (j.error != null && String(j.error).trim()) {
          return String(j.error).trim()
        }
      } catch {
        if (body.length < 200) return body
      }
    }
    if (msg) return msg
  }
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const errVal = (data as { error: unknown }).error
    if (errVal != null && String(errVal).trim()) return String(errVal).trim()
  }
  return 'فشل الاستجابة من الدالة (لا تفاصيل).'
}

export async function playSpeechViaEdgeTts(text: string): Promise<EdgeTtsPlayResult> {
  if (!edgeTtsEnabled()) {
    return { ok: false, message: 'مسار Edge TTS غير مفعّل (VITE_USE_EDGE_TTS=1) أو Supabase غير مضبوط.' }
  }
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, message: 'نص فارغ.' }
  try {
    const { data, error } = await supabase.functions.invoke('tts-announce', {
      body: { text: trimmed.slice(0, 500) },
    })
    if (error) {
      const message = formatInvokeFailure(error, data)
      console.warn('[tts-announce]', error, data)
      return { ok: false, message }
    }
    if (!data || typeof data !== 'object') {
      return { ok: false, message: 'استجابة فارغة من الدالة — تحقق من النشر والاسم tts-announce.' }
    }
    const b64 =
      'audioBase64' in data ? String((data as { audioBase64: unknown }).audioBase64) : ''
    if (!b64) {
      return { ok: false, message: 'لا يوجد audioBase64 في الاستجابة — راجع سجلات الدالة في Supabase.' }
    }
    try {
      await playMp3FromBase64(b64)
    } catch (playErr) {
      const m = playErr instanceof Error ? playErr.message : String(playErr)
      return { ok: false, message: `تعذّر تشغيل الصوت في المتصفح: ${m}` }
    }
    return { ok: true }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    console.warn('[tts-announce]', e)
    return { ok: false, message: m || 'خطأ شبكة أو CORS.' }
  }
}
