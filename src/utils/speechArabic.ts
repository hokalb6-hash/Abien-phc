/**
 * إعلان صوتي بالعربية (Web Speech API).
 * على أندرويد/لوحات ذكية/WebView: يُفضّل استدعاء primeCallAudioInUserGesture() متزامناً مع النقر،
 * وتأخير قصير بعد speechSynthesis.cancel() (WebKit)، واختيار صوت عربي صريح إن وُجد.
 */
import { playCallChime, primeCallAudioInUserGesture } from './callChime'

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
  const voice = pickArabicVoice()
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

export function speakArabic(text: string, opts?: { rate?: number; cancelPrior?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  primeSpeechVoices()
  if (opts?.cancelPrior !== false) {
    clearArabicAnnouncementQueue()
    window.speechSynthesis.cancel()
  }
  speakAfterCancel(() => {
    prepareSynthesis()
    const u = buildUtterance(text, opts?.rate ?? 0.9)
    try {
      window.speechSynthesis.speak(u)
    } catch {
      /* ignore */
    }
  }, 48)
}

export function stopArabicSpeech() {
  clearArabicAnnouncementQueue()
}

/** للواجهة: هل يبدو أن المتصفح يدعم التركيب الصوتي (قد تبقى الأصوات فارغة حتى بعد voiceschanged) */
export function hasSpeechSynthesisAPI(): boolean {
  return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'
}
