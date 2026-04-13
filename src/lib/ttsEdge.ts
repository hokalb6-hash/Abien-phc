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

export async function playSpeechViaEdgeTts(text: string): Promise<boolean> {
  if (!edgeTtsEnabled()) return false
  const trimmed = text.trim()
  if (!trimmed) return false
  try {
    const { data, error } = await supabase.functions.invoke('tts-announce', {
      body: { text: trimmed.slice(0, 500) },
    })
    if (error) return false
    if (!data || typeof data !== 'object') return false
    const b64 =
      'audioBase64' in data ? String((data as { audioBase64: unknown }).audioBase64) : ''
    if (!b64) return false
    await playMp3FromBase64(b64)
    return true
  } catch {
    return false
  }
}
