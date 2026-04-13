/**
 * إعلان صوتي بالعربية (Web Speech API).
 * Chrome/Android: يجب تشغيل الصوت داخل نفس لحظة تفاعل المستخدم؛ التأخير بـ setTimeout قد يلغي التفعيل.
 * استخدم primeDisplayVoiceInUserGesture() في أول سطر من onPointerDown/onClick، ورسالة التفعيل بـ immediate: true.
 */
import { playCallChime, primeCallAudioInUserGesture } from './callChime'

const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA='

/**
 * يُستدعى متزامناً مع لمس/نقر المستخدم (قبل أي await أو setState).
 * يفتح Web Audio + يستأنف speechSynthesis + يجرّب تشغيلاً صامتاً لفتح قناة HTML Audio (Chrome على الهاتف والتلفاز).
 */
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

/** تحميل أصوات Chrome/Android الكسولة */
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

/** إن لم يوجد صوت عربي (شائع على التلفاز) نستخدم أي صوت متاح حتى لا يبقى النطق صامتاً */
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

/** بعد cancel() مباشرةً، WebKit/Safari وأحياناً أندرويد لا يبدأون speak — تأخير بسيط */
function speakAfterCancel(run: () => void, delayMs: number): void {
  window.setTimeout(run, delayMs)
}

function drainAnnouncementQueue() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    announcementQueue = []
    announcementProcessing = false
    return
  }
  if (announcementProcessing || announcementQueue.length === 0) return

  const item = announcementQueue.shift()!
  announcementProcessing = true
  window.speechSynthesis.cancel()

  const startSpeak = () => {
    prepareSynthesis()
    const u = buildUtterance(item.text, 0.9)
    const done = () => {
      announcementProcessing = false
      drainAnnouncementQueue()
    }
    u.onend = done
    u.onerror = done
    try {
      window.speechSynthesis.speak(u)
    } catch {
      done()
    }
  }

  if (item.withChime) {
    primeCallAudioInUserGesture()
    playCallChime()
    speakAfterCancel(startSpeak, 160)
  } else {
    speakAfterCancel(startSpeak, 48)
  }
}

function clearArabicAnnouncementQueue() {
  announcementQueue = []
  announcementProcessing = false
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

export function enqueueArabicAnnouncement(text: string, opts?: { withChime?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  primeSpeechVoices()
  announcementQueue.push({ text, withChime: opts?.withChime !== false })
  drainAnnouncementQueue()
}

/** `immediate`: للنطق مباشرة بعد النقر (رسالة التفعيل) — بدون setTimeout حتى لا يلغي Chrome صلاحية التشغيل */
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
      /* ignore — onerror يلتقط أغلب الحالات */
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
    /** أندرويد/التلفاز: الأصوات تُحمَّل متأخراً — محاولة ثانية نادرة التكرار لكن تقلّل الصمت */
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

/** للواجهة: هل يبدو أن المتصفح يدعم التركيب الصوتي (قد تبقى الأصوات فارغة حتى بعد voiceschanged) */
export function hasSpeechSynthesisAPI(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}
