import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Volume2, VolumeX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { SITE_DEVELOPER_CREDIT_AR } from '../../constants/brand'
import { CLINIC_TYPES } from '../../constants/clinics'
import type { Patient, Queue } from '../../types/db'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatQueueNumber, queueStatusLabel } from '../../utils/format'
import { resumeCallAudioContext } from '../../utils/callChime'
import {
  enqueueArabicAnnouncement,
  hasSpeechSynthesisAPI,
  primeDisplayVoiceInUserGesture,
  speakArabic,
  stopArabicSpeech,
} from '../../utils/speechArabic'

type DisplayQueue = Queue & {
  patients: Pick<Patient, 'full_name'> | null
}

const ACTIVE: Queue['status'][] = ['waiting', 'called', 'in_service']

/** أقصى عدد يُعرض لكل عيادة؛ عند اختفاء أحد المستفيدين يظهر التالي في الترتيب */
const DISPLAY_LIMIT_PER_CLINIC = 5

function statusDisplayPriority(s: Queue['status']): number {
  if (s === 'called') return 0
  if (s === 'in_service') return 1
  return 2
}

function topQueuesForClinic(all: DisplayQueue[], clinicType: string): DisplayQueue[] {
  return all
    .filter((q) => q.clinic_type === clinicType)
    .sort((a, b) => {
      const pa = statusDisplayPriority(a.status)
      const pb = statusDisplayPriority(b.status)
      if (pa !== pb) return pa - pb
      return a.queue_number - b.queue_number
    })
    .slice(0, DISPLAY_LIMIT_PER_CLINIC)
}

function buildCallAnnouncement(q: DisplayQueue): string {
  const name = q.patients?.full_name?.trim() || 'المراجع'
  const num = formatQueueNumber(q.queue_number)
  const clinic = clinicTypeLabel(q.clinic_type)
  return `نرجو من ${name}، صاحب رقم الدور ${num}، التوجّه إلى ${clinic}.`
}

/**
 * شاشة تلفاز: أدوار اليوم؛ حتى 5 مستفيدين لكل عيادة (يظهر التالي عند انتهاء/اختفاء أحدهم)، وإعلان صوتي عند الاستدعاء.
 */
export default function QueueDisplay() {
  const [rows, setRows] = useState<DisplayQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem('abien_display_voice') === '1'
    } catch {
      return false
    }
  })
  const prevStatusRef = useRef<Map<string, Queue['status']>>(new Map())
  const lastVoiceOnRef = useRef(false)
  const [clock, setClock] = useState(() => new Date())
  /** عند فشل WebSocket نستطلع أسرع (5 ث) حتى يقترب من «لحظي» قدر الإمكان */
  const [realtimeDegraded, setRealtimeDegraded] = useState(false)

  const loadQueues = useCallback(async () => {
    const { data, error: qError } = await supabase
      .from('queues')
      .select('*, patients (full_name)')
      .eq('service_date', todayAdenYMD())
      .in('status', ACTIVE)
      .order('queue_number', { ascending: true })

    if (qError) {
      setError(qError.message)
      toast.error(qError.message)
      return
    }
    setError(null)
    setRows((data ?? []) as DisplayQueue[])
  }, [])

  useEffect(() => {
    let cancelled = false
    let warnedRealtime = false
    let degradeToastTimer: ReturnType<typeof setTimeout> | undefined

    void (async () => {
      setLoading(true)
      await loadQueues()
      if (!cancelled) setLoading(false)
    })()

    const channel = supabase
      .channel('queues-display-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queues' },
        () => {
          void loadQueues()
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          if (degradeToastTimer) clearTimeout(degradeToastTimer)
          degradeToastTimer = undefined
          setRealtimeDegraded(false)
          return
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (degradeToastTimer) clearTimeout(degradeToastTimer)
          degradeToastTimer = setTimeout(() => {
            if (cancelled) return
            setRealtimeDegraded(true)
            if (!warnedRealtime) {
              warnedRealtime = true
              console.warn(
                '[شاشة الدور] Realtime غير متصل — القائمة تُحدَّث بالاستطلاع. للتصليح: نفّذ supabase/patch_queue_display_realtime.sql في SQL Editor (سياسات anon + نشر الجدول).',
                status,
                err,
              )
            }
          }, 2000)
        }
      }, 25_000)

    return () => {
      cancelled = true
      if (degradeToastTimer) clearTimeout(degradeToastTimer)
      void supabase.removeChannel(channel)
    }
  }, [loadQueues])

  /** استطلاع احتياطي لشاشة التلفاز؛ أسرع عند تعطّل Realtime */
  useEffect(() => {
    const ms = realtimeDegraded ? 5000 : 15_000
    const poll = setInterval(() => {
      void loadQueues()
    }, ms)
    return () => clearInterval(poll)
  }, [loadQueues, realtimeDegraded])

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const map = prevStatusRef.current
    if (voiceOn && !lastVoiceOnRef.current) {
      for (const q of rows) map.set(q.id, q.status)
      lastVoiceOnRef.current = true
      return
    }
    if (!voiceOn) {
      lastVoiceOnRef.current = false
      stopArabicSpeech()
      return
    }
    for (const q of rows) {
      const was = map.get(q.id)
      map.set(q.id, q.status)
      if (q.status === 'called' && was !== undefined && was !== 'called') {
        enqueueArabicAnnouncement(buildCallAnnouncement(q), { withChime: true })
      }
    }
    for (const id of [...map.keys()]) {
      if (!rows.some((r) => r.id === id)) map.delete(id)
    }
  }, [rows, voiceOn])

  function enableVoiceAnnouncement() {
    /** أول سطر: تفعيل Chrome/Android — Web Audio + Speech + HTML Audio */
    primeDisplayVoiceInUserGesture()
    if (!hasSpeechSynthesisAPI()) {
      toast.error('هذا المتصفح لا يدعم الإعلان الصوتي المحلي. يلزم تشغيل TTS من الخادم لهذا الجهاز.')
      return
    }
    setVoiceOn(true)
    try {
      localStorage.setItem('abien_display_voice', '1')
    } catch {
      /* ignore */
    }
    void resumeCallAudioContext()
    speakArabic('تم تفعيل الإعلان الصوتي.', { cancelPrior: true, immediate: true })
  }

  function disableVoiceAnnouncement() {
    setVoiceOn(false)
    try {
      localStorage.setItem('abien_display_voice', '0')
    } catch {
      /* ignore */
    }
    stopArabicSpeech()
  }

  function toggleVoice() {
    if (voiceOn) {
      disableVoiceAnnouncement()
      return
    }
    enableVoiceAnnouncement()
  }

  return (
    <div dir="rtl" className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 text-white md:px-8 md:py-10">
      {!voiceOn ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 backdrop-blur-sm">
          <button
            type="button"
            onPointerDown={() => primeDisplayVoiceInUserGesture()}
            onClick={() => enableVoiceAnnouncement()}
            className="flex min-h-[120px] w-full max-w-xl touch-manipulation flex-col items-center justify-center gap-3 rounded-3xl border-2 border-teal-500 bg-slate-900/95 px-6 py-8 text-center shadow-2xl shadow-teal-950/40"
          >
            <Volume2 className="h-10 w-10 text-teal-300" aria-hidden />
            <span className="text-2xl font-black text-white md:text-3xl">اضغط هنا لتفعيل الإعلان الصوتي</span>
            <span className="text-sm leading-relaxed text-slate-300 md:text-base">
              يلزم ضغط مرة واحدة فقط على الشاشة أو الريموت حتى يسمح Chrome بتشغيل الصوت ثم يبقى الإعلان مفعلاً.
            </span>
          </button>
        </div>
      ) : null}
      <header className="mx-auto mb-8 max-w-7xl border-b border-slate-700/80 pb-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:items-start">
          <div className="text-center sm:text-start">
            <h1 className="text-3xl font-black tracking-tight text-teal-400 md:text-5xl">أبين الصحي</h1>
            <p className="mt-2 text-lg text-slate-300 md:text-xl">دور الانتظار — اليوم</p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
              تُعرض حتى خمسة مستفيدين لكل عيادة (يُفضَّل عرض المستدعى ثم قيد الكشف ثم الانتظار). عند انتهاء خدمة أحدهم
              يظهر صاحب الدور التالي تلقائياً. الرجاء الانتباه لرقمكم.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
            <p className="font-mono text-sm text-slate-500">
              {clock.toLocaleDateString('ar-YE', { weekday: 'long', day: 'numeric', month: 'long' })} —{' '}
              {clock.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <button
              type="button"
              onPointerDown={() => primeDisplayVoiceInUserGesture()}
              onClick={() => toggleVoice()}
              className={`flex min-h-[48px] min-w-[48px] touch-manipulation items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition md:text-base ${
                voiceOn
                  ? 'border-teal-500 bg-teal-950/50 text-teal-300'
                  : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:border-slate-500'
              }`}
            >
              {voiceOn ? <Volume2 className="h-5 w-5 shrink-0" aria-hidden /> : <VolumeX className="h-5 w-5 shrink-0" aria-hidden />}
              {voiceOn ? 'الصوت مفعّل' : 'تفعيل الإعلان الصوتي'}
            </button>
            <p className="max-w-[280px] text-center text-xs text-slate-500 sm:text-end">
              Chrome يفرض نقرة حقيقية لتشغيل الصوت (لا يمكن تلقائياً عند فتح الصفحة). اضغط الزر مرة؛ إن سكت الصوت في
              الإعدادات: أيقونة القفل → أذونات الموقع → الصوت = السماح. عند الاستدعاء: جرس ثم نطق الاسم والدور
              والعيادة. على بعض أجهزة التلفاز إن بقي الصوت صامتاً فـ Web Speech غير مدعوم — يلزم إعلان صوتي من الخادم
              (TTS).
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-teal-400 border-t-transparent" />
        </div>
      ) : error ? (
        <p className="text-center text-2xl text-red-400">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-2xl text-slate-400">لا يوجد مراجعون في الانتظار حالياً لهذا اليوم</p>
      ) : (
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {CLINIC_TYPES.map((clinicType) => {
              const slice = topQueuesForClinic(rows, clinicType)
              return (
                <section
                  key={clinicType}
                  aria-labelledby={`clinic-${clinicType}`}
                  className="flex flex-col rounded-2xl border border-slate-700/80 bg-slate-900/40 p-4 md:p-5"
                >
                  <h2
                    id={`clinic-${clinicType}`}
                    className="mb-4 border-b border-slate-600/60 pb-3 text-center text-lg font-bold text-teal-300 md:text-xl"
                  >
                    {clinicTypeLabel(clinicType)}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      يُعرض حتى {DISPLAY_LIMIT_PER_CLINIC} مستفيدين — يظهر التالي عند انتهاء أحدهم
                    </span>
                  </h2>
                  {slice.length === 0 ? (
                    <p className="flex flex-1 items-center justify-center py-10 text-center text-slate-500">
                      لا مراجعين في القائمة الحالية
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {slice.map((q) => (
                        <li key={q.id}>
                          <QueueCard q={q} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )
            })}
          </div>
        </div>
      )}

      <footer className="mx-auto mt-12 max-w-7xl border-t border-slate-800 pt-6 text-center text-sm text-slate-500">
        {SITE_DEVELOPER_CREDIT_AR}
      </footer>
    </div>
  )
}

function queueCardClass(q: DisplayQueue): string {
  if (q.status === 'called') {
    return 'rounded-xl border-2 border-amber-500/70 bg-amber-950/30 p-4 shadow-lg shadow-amber-900/20'
  }
  if (q.status === 'in_service') {
    return 'rounded-xl border border-sky-800/80 bg-sky-950/25 p-4 shadow-md shadow-sky-950/40'
  }
  return 'rounded-xl border border-slate-700 bg-slate-900/60 p-4'
}

function QueueCard({ q }: { q: DisplayQueue }) {
  const name = q.patients?.full_name?.trim() || '—'
  const highlight = q.status === 'called'
  const compact = q.status === 'waiting'
  return (
    <div className={queueCardClass(q)}>
      <div className="flex flex-col gap-2 text-center sm:text-start">
        <div className="flex flex-wrap items-baseline justify-center gap-2 sm:justify-between">
          <span
            className={`text-xs font-medium uppercase tracking-wider text-slate-500 ${highlight ? 'text-amber-200/80' : ''}`}
          >
            رقم الدور
          </span>
          <span
            className={`font-black tabular-nums text-teal-300 ${compact ? 'text-3xl' : highlight ? 'text-4xl md:text-5xl' : 'text-4xl md:text-5xl'}`}
          >
            {formatQueueNumber(q.queue_number)}
          </span>
        </div>
        <p className={`font-bold text-white ${compact ? 'text-lg' : 'text-xl md:text-2xl'}`}>{name}</p>
        <p className="flex items-center justify-center gap-2 text-sm text-slate-400 sm:justify-start md:text-base">
          {highlight ? (
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
          ) : null}
          {queueStatusLabel(q.status)}
        </p>
      </div>
    </div>
  )
}
