/**
 * إعلان صوتي بالعربية (Web Speech API) — يتطلّب تفاعلاً من المستخدم أحياناً لتفعيل الصوت في المتصفح.
 */
import { playCallChime } from './callChime'

type QueueItem = { text: string; withChime: boolean }

let announcementQueue: QueueItem[] = []
let announcementProcessing = false

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
    const u = new SpeechSynthesisUtterance(item.text)
    u.lang = 'ar-SA'
    u.rate = 0.9
    const done = () => {
      announcementProcessing = false
      drainAnnouncementQueue()
    }
    u.onend = done
    u.onerror = done
    window.speechSynthesis.speak(u)
  }

  if (item.withChime) {
    playCallChime()
    window.setTimeout(startSpeak, 140)
  } else {
    startSpeak()
  }
}

/** يفرّغ طابور إعلانات الاستدعاء (عدة مرضى دفعة واحدة) */
function clearArabicAnnouncementQueue() {
  announcementQueue = []
  announcementProcessing = false
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

/**
 * يضيف إعلاناً إلى الطابور؛ تُنطق بالتتابع دون إلغاء الإعلان السابق.
 * مناسب عندما يتحوّل أكثر من دور إلى «مستدعى» في نفس التحديث.
 */
export function enqueueArabicAnnouncement(text: string, opts?: { withChime?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  announcementQueue.push({ text, withChime: opts?.withChime !== false })
  drainAnnouncementQueue()
}

export function speakArabic(text: string, opts?: { rate?: number; cancelPrior?: boolean }) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  if (opts?.cancelPrior !== false) {
    clearArabicAnnouncementQueue()
    window.speechSynthesis.cancel()
  }
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ar-SA'
  u.rate = opts?.rate ?? 0.9
  window.speechSynthesis.speak(u)
}

export function stopArabicSpeech() {
  clearArabicAnnouncementQueue()
}
