import { Link } from 'react-router-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { LOCAL_TIMEZONE_LABEL_AR, tomorrowAdenYMD } from '../../utils/adenCalendar'
import { SITE_DEVELOPER_CREDIT_AR } from '../../constants/brand'
import { BrandMark } from '../../components/BrandMark'
import { PatientAnnouncementBanner } from '../../components/PatientAnnouncementBanner'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { formatDateTime, formatQueueNumber } from '../../utils/format'

/** العيادات الثلاث المعتمدة في المركز — قيم clinic_type في قاعدة البيانات */
const CLINIC_OPTIONS: { value: string; label: string }[] = [
  { value: 'internal', label: 'العيادة الداخلية' },
  { value: 'gynecology', label: 'العيادة النسائية' },
  { value: 'pediatrics', label: 'عيادة الأطفال' },
]

const initialForm = {
  full_name: '',
  national_id: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  clinic_type: 'internal',
}

type BookingResult = {
  fullName: string
  clinicLabel: string
  queueNumber: number
  createdAt: string
  /** يوم تقديم الخدمة (غدٍ بتوقيت المركز للحجز من الموقع) */
  serviceDate: string
}

type CanBookPayload = {
  allowed: boolean
  booked: number
  cap: number
  remaining: number
  service_date: string
}

function formatServiceDateAr(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map((x) => parseInt(x, 10))
  if (!y || !m || !d) return isoDate
  return new Intl.DateTimeFormat('ar-YE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

/**
 * حجز دور من المنزل (أو أي مكان) — بدون تسجيل دخول.
 * يتطلّب في Supabase سياسات RLS تسمح لدور anon بإدراج patients و queues.
 */
export default function PatientCheckIn() {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [savingImage, setSavingImage] = useState(false)
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null)
  const [slotInfo, setSlotInfo] = useState<CanBookPayload | null>(null)
  const [slotLoading, setSlotLoading] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setSlotLoading(true)
    void (async () => {
      const { data, error } = await supabase.rpc('can_book_clinic_tomorrow', {
        p_clinic_type: form.clinic_type,
      })
      if (cancelled) return
      setSlotLoading(false)
      if (error || data == null || typeof data !== 'object') {
        setSlotInfo(null)
        return
      }
      const o = data as Record<string, unknown>
      setSlotInfo({
        allowed: Boolean(o.allowed),
        booked: Number(o.booked) || 0,
        cap: Number(o.cap) || 50,
        remaining: Number(o.remaining) || 0,
        service_date: String(o.service_date ?? tomorrowAdenYMD()),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [form.clinic_type])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function saveReceiptImage() {
    if (!receiptRef.current || !bookingResult) return
    setSavingImage(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(receiptRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#ffffff',
      })
      const blob = await (await fetch(dataUrl)).blob()
      const filename = `ابين-الصحي-دور-${bookingResult.queueNumber}.png`
      const file = new File([blob], filename, { type: 'image/png' })

      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: 'أبين الصحي — تفاصيل الدور',
            text: `رقم دوري ${formatQueueNumber(bookingResult.queueNumber)} — ${bookingResult.clinicLabel}`,
          })
          toast.success('إن ظهرت لك خيارات المشاركة، يمكنك اختيار «حفظ في الصور» أو تطبيق المعرض.')
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
        }
      }

      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      a.rel = 'noopener'
      a.click()
      toast.success(
        'تم تنزيل الصورة. على الهاتف: افتح «التنزيلات» ثم الصورة واختر «إضافة إلى الصور» أو شارِكها ثم احفظها في المعرض.',
        { duration: 9000 },
      )
    } catch {
      toast.error('تعذر إنشاء الصورة. جرّب متصفحاً آخر أو حدّث الصفحة.')
    } finally {
      setSavingImage(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      toast.error('الرجاء إدخال الاسم الكامل')
      return
    }
    if (!form.clinic_type) {
      toast.error('اختر العيادة')
      return
    }
    if (slotInfo && !slotInfo.allowed) {
      toast.error('اكتملت حجوزات غدٍ لهذه العيادة (الحد 50). جرّب عيادة أخرى.')
      return
    }

    const clinicLabel =
      CLINIC_OPTIONS.find((o) => o.value === form.clinic_type)?.label ?? form.clinic_type
    const fullName = form.full_name.trim()

    setSaving(true)
    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          full_name: fullName,
          national_id: form.national_id.trim() || null,
          phone: form.phone.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
        })
        .select('id')
        .single()

      if (patientError) {
        console.error(patientError)
        toast.error(patientError.message || 'تعذر حفظ البيانات. تحقق من الاتصال أو صلاحيات التسجيل.')
        return
      }

      const { data: queue, error: queueError } = await supabase
        .from('queues')
        .insert({
          patient_id: patient.id,
          clinic_type: form.clinic_type,
          status: 'waiting',
        })
        .select('id, queue_number, clinic_type, status, created_at, service_date')
        .single()

      if (queueError) {
        console.error(queueError)
        toast.error(queueError.message || 'تعذر إصدار رقم الدور')
        return
      }

      setBookingResult({
        fullName,
        clinicLabel,
        queueNumber: queue.queue_number,
        createdAt: queue.created_at,
        serviceDate: queue.service_date,
      })
      setForm(initialForm)
      toast.success('تم حجز دورك بنجاح', { duration: 4000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-100">
      <PatientAnnouncementBanner />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <header className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={56} className="mb-3 rounded-2xl bg-white/90 p-2 shadow-md ring-1 ring-teal-100" />
          <h1 className="text-2xl font-bold text-teal-800 md:text-3xl">أبين الصحي</h1>
          <p className="mt-1 text-slate-600">حجز دور من منزلك</p>
          <p className="mt-2 text-sm text-slate-500">لا حاجة لزيارة الاستقبال لاستلام الرقم — سجّل من هاتفك أو جهازك</p>
        </header>

        <Card title="بيانات الحجز">
          <p className="mb-4 text-sm text-slate-600">
            الحجز من هنا مخصّص لـ <span className="font-semibold text-teal-800">يوم الغد</span> فقط (توقيت{' '}
            {LOCAL_TIMEZONE_LABEL_AR})،
            بحد أقصى <span className="font-semibold">50</span> مريضاً لكل عيادة في ذلك اليوم.
          </p>
          {slotLoading ? (
            <p className="mb-4 text-sm text-slate-500">جاري التحقق من المقاعد المتاحة…</p>
          ) : slotInfo ? (
            <p
              className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                slotInfo.allowed
                  ? 'border-teal-200 bg-teal-50 text-teal-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              {slotInfo.allowed ? (
                <>
                  متبقٍ لغدٍ ({formatServiceDateAr(slotInfo.service_date)}):{' '}
                  <strong>{slotInfo.remaining}</strong> من {slotInfo.cap} مقعداً لهذه العيادة.
                </>
              ) : (
                <>اكتملت حجوزات غدٍ لهذه العيادة. اختر عيادة أخرى أو حاول لاحقاً.</>
              )}
            </p>
          ) : null}
          <p className="mb-6 text-sm text-slate-600">
            بعد الإرسال يُصدر النظام رقم دورك مباشرة. يمكنك إكمال هذا النموذج من المنزل في أي وقت قبل التوجّه إلى
            المركز.
          </p>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <Input
              label="الاسم الكامل"
              name="full_name"
              value={form.full_name}
              onChange={(e) => update('full_name', e.target.value)}
              required
              autoComplete="name"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="رقم الهوية / الجواز (اختياري)"
                name="national_id"
                value={form.national_id}
                onChange={(e) => update('national_id', e.target.value)}
                dir="ltr"
              />
              <Input
                label="رقم الجوال (اختياري)"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="تاريخ الميلاد (اختياري)"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => update('date_of_birth', e.target.value)}
                dir="ltr"
              />
              <Select
                label="الجنس (اختياري)"
                name="gender"
                value={form.gender}
                onChange={(e) => update('gender', e.target.value)}
              >
                <option value="">—</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
            </div>
            <Select
              label="العيادة المطلوبة"
              name="clinic_type"
              value={form.clinic_type}
              onChange={(e) => update('clinic_type', e.target.value)}
              required
            >
              {CLINIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={saving || slotLoading || (slotInfo != null && !slotInfo.allowed)}
                className="min-w-[180px] justify-center"
              >
                {saving ? 'جاري الحجز…' : 'تأكيد الحجز واحصل على رقم الدور'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => setForm(initialForm)}
              >
                مسح الحقول
              </Button>
            </div>
          </form>
        </Card>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm text-slate-500">
          <Link to="/" className="font-medium text-teal-700 underline-offset-2 hover:underline">
            الصفحة الرئيسية
          </Link>
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            |
          </span>
          <Link to="/login" className="font-medium text-teal-700 underline-offset-2 hover:underline">
            دخول الموظفين
          </Link>
        </p>

        <footer className="mt-8 border-t border-slate-200/80 pt-4 text-center text-xs text-slate-500">
          {SITE_DEVELOPER_CREDIT_AR}
        </footer>
      </div>

      {bookingResult ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-success-title"
        >
          <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <h2 id="booking-success-title" className="text-center text-xl font-bold text-teal-800">
              تم حجز دورك
            </h2>
            <p className="mt-2 text-center text-sm text-slate-600">
              راجع التفاصيل واحفظ الصورة في جهازك أو المعرض حتى لا تنسَ رقمك.
            </p>

            <div className="mt-6 flex justify-center">
              <div
                ref={receiptRef}
                dir="rtl"
                className="w-full max-w-[340px] rounded-2xl border-4 border-teal-600 bg-gradient-to-b from-teal-50 to-white px-6 py-8 text-center text-slate-900 shadow-inner"
              >
                <p className="text-sm font-semibold text-teal-800">أبين الصحي</p>
                <p className="mt-1 text-xs text-slate-500">تذكرة الدور الإلكترونية</p>
                <p className="mt-6 text-5xl font-black tabular-nums text-teal-700">
                  {formatQueueNumber(bookingResult.queueNumber)}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-600">رقم الدور</p>
                <div className="mt-6 space-y-2 border-t border-teal-200 pt-4 text-start text-sm">
                  <p>
                    <span className="text-slate-500">الاسم:</span>{' '}
                    <span className="font-semibold text-slate-900">{bookingResult.fullName}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">العيادة:</span>{' '}
                    <span className="font-semibold text-slate-900">{bookingResult.clinicLabel}</span>
                  </p>
                  <p>
                    <span className="text-slate-500">يوم الدور:</span>{' '}
                    <span className="font-semibold text-slate-900">
                      {formatServiceDateAr(bookingResult.serviceDate)}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">وقت الحجز:</span>{' '}
                    <span className="font-medium text-slate-800">{formatDateTime(bookingResult.createdAt)}</span>
                  </p>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  سيظهر رقمك على شاشة الدور في المركز. تقدَّم للعيادة دون المرور على الاستقبال لأخذ رقم يدوياً.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Button
                type="button"
                className="w-full justify-center gap-2"
                disabled={savingImage}
                onClick={() => void saveReceiptImage()}
              >
                {savingImage ? 'جاري تجهيز الصورة…' : 'حفظ تذكرة الدور كصورة (للمعرض أو الملفات)'}
              </Button>
              <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => setBookingResult(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
