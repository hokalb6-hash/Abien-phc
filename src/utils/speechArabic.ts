/**
 * إعلان صوتي: مسار Edge TTS المجاني (MP3 base64 من دالة tts-announce) عند VITE_USE_EDGE_TTS=1، ثم احتياطي Web Speech.
 * شاشات التلفاز غالباً تعطّل speechSynthesis بينما Web Audio (الصفارة) يعمل — لا يُعتمد على المحلي وحده.
 */
import { playCallChime, primeCallAudioInUserGesture } from './callChime'
import { edgeTtsEnabled, playSpeechViaEdgeTts, stopEdgeTtsPlayback } from '../lib/ttsEdge'

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

export function primeDisplayVoiceInUserGesture(): void {
  primeCallAudioInUserGesture()
  if (typeof window === 'undefined') return
  try {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.resume()
    }
  } catch {
    /* ignore */
  }
  try {
    const a = new Audio()
    a.src = SILENT_WAV
    void a.play().catch(() => {})
  } catch {
    /* ignore */
  }
}

type QueueItem = { text: string; withChime: boolean }

let announcementQueue: QueueItem[] = []
let announcementProcessing = false

function primeSpeechVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.getVoices()
  } catch {
    /* ignore */
  }
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  primeSpeechVoices()
  window.speechSynthesis.onvoiceschanged = primeSpeechVoices
}

function pickArabicVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const list = window.speechSynthesis.getVoices()
  if (!list.length) return null
  const lower = (l: string) => l.toLowerCase()
  const find = (pred: (v: SpeechSynthesisVoice) => boolean) => list.find(pred) ?? null
  return (
    find((v) => lower(v.lang).startsWith('ar-sa')) ||
    find((v) => lower(v.lang).startsWith('ar-')) ||
    find((v) => lower(v.lang) === 'ar') ||
    find((v) => /arabic|عربي/i.test(v.name)) ||
    null
  )
}

function pickVoiceForUtterance(): SpeechSynthesisVoice | null {
  const ar = pickArabicVoice()
  if (ar) return ar
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const list = window.speechSynthesis.getVoices()
  return list[0] ?? null
}

function prepareSynthesis(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.resume()
  } catch {
    /* ignore */
  }
}

function buildUtterance(text: string, rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ar-SA'
  u.rate = rate
  u.volume = 1
  u.pitch = 1
  const voice = pickVoiceForUtterance()
  if (voice) u.voice = voice
  return u
}

function speakAfterCancel(run: () => void, delayMs: number): void {
  window.setTimeout(run, delayMs)
}

function speakNativeItem(item: QueueItem, delayAfterCancelMs: number): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve()
  }
  window.speechSynthesis.cancel()
  return new Promise((resolve) => {
    speakAfterCancel(() => {
      prepareSynthesis()
      const u = buildUtterance(item.text, 0.9)
      const done = () => resolve()
      u.onend = done
      u.onerror = done
      try {
        window.speechSynthesis.speak(u)
      } catch {
        done()
      }
    }, delayAfterCancelMs)
  })
}

async function drainAnnouncementQueue(): Promise<void> {
  if (typeof window === 'undefined') {
    announcementQueue = []
    announcementProcessing = false
    return
  }

  const canEdge = edgeTtsEnabled()
  const canNative = typeof window.speechSynthesis !== 'undefined'

  if (!canEdge && !canNative) {
    announcementQueue = []
    announcementProcessing = false
    return
  }

  if (announcementProcessing || announcementQueue.length === 0) return

  announcementProcessing = true
  const item = announcementQueue.shift()!

  try {
    let chimePlayed = false
    if (item.withChime) {
      primeCallAudioInUserGesture()
      playCallChime()
      chimePlayed = true
      await new Promise<void>((r) => setTimeout(r, 200))
    }

    if (canEdge) {
      const tts = await playSpeechViaEdgeTts(item.text)
      if (tts.ok) return
      console.warn('[tts-announce]', tts.message)
    }

    if (!canNative) return

    const delayMs = chimePlayed ? 48 : item.withChime ? 160 : 48
    await speakNativeItem(item, delayMs)
  } finally {
    announcementProcessing = false
    void drainAnnouncementQueue()
  }
}

function clearArabicAnnouncementQueue() {
  announcementQueue = []
  announcementProcessing = false
  stopEdgeTtsPlayback()
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function enqueueArabicAnnouncement(text: string, opts?: { withChime?: boolean }) {
  if (typeof window === 'undefined') return
  if (!edgeTtsEnabled() && !window.speechSynthesis) return
  primeSpeechVoices()
  announcementQueue.push({ text, withChime: opts?.withChime !== false })
  void drainAnnouncementQueue()
}

export function speakArabic(
  text: string,
  opts?: {
    rate?: number
    cancelPrior?: boolean
    immediate?: boolean
    onError?: (ev: SpeechSynthesisErrorEvent) => void
  },
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  primeSpeechVoices()
  if (opts?.cancelPrior !== false) {
    clearArabicAnnouncementQueue()
    window.speechSynthesis.cancel()
  }

  const run = () => {
    prepareSynthesis()
    const u = buildUtterance(text, opts?.rate ?? 0.9)
    u.onerror = (ev) => {
      opts?.onError?.(ev)
    }
    try {
      window.speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
  }

  if (opts?.immediate) {
    const go = () => {
      if (opts?.cancelPrior !== false) {
        queueMicrotask(run)
      } else {
        run()
      }
    }
    go()
    if (window.speechSynthesis.getVoices().length === 0) {
      window.setTimeout(() => {
        primeSpeechVoices()
        go()
      }, 500)
    }
    return
  }

  speakAfterCancel(run, 48)
}

export function stopArabicSpeech() {
  clearArabicAnnouncementQueue()
}

export function hasSpeechSynthesisAPI(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}

export function canUseDisplayVoice(): boolean {
  return hasSpeechSynthesisAPI() || edgeTtsEnabled()
}
