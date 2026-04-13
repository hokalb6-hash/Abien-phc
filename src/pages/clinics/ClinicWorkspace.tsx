import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { FlaskConical, List, RefreshCw, Siren, Stethoscope, User, UserPlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CLINIC_LABELS, CLINIC_TYPES, type ClinicTypeValue } from '../../constants/clinics'
import { LAB_TEST_CATALOG, labelsFromLabTestIds, parseRequestedLabTests } from '../../constants/labTests'
import type { Diagnosis, Medication, Patient, Prescription, Queue, Referral } from '../../types/db'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatDateTime, queueStatusLabel, referralStatusLabel } from '../../utils/format'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'

type QueuePatient = Pick<Patient, 'id' | 'full_name' | 'phone' | 'national_id' | 'date_of_birth' | 'gender'>
type QueueDiagnosis = Pick<Diagnosis, 'id' | 'name_ar' | 'code'>

type QueueDiagRow = {
  diagnosis_id: string
  created_at?: string
  diagnoses: QueueDiagnosis | null
}

export type QueueWithRelations = Queue & {
  patients: QueuePatient | null
  queue_diagnoses: QueueDiagRow[] | null
}

type RxWithMed = Prescription & { medications: Medication | null }

export default function ClinicWorkspace() {
  const [rows, setRows] = useState<QueueWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clinicFilter, setClinicFilter] = useState<ClinicTypeValue | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<Queue['status'] | 'all'>('all')
  const [walkIn, setWalkIn] = useState({
    full_name: '',
    phone: '',
    national_id: '',
    date_of_birth: '',
    gender: '',
    clinic_type: '' as ClinicTypeValue | '',
  })
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [walkInDrawerOpen, setWalkInDrawerOpen] = useState(false)

  const loadQueues = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('queues')
        .select(
          '*, patients (id, full_name, phone, national_id, date_of_birth, gender), queue_diagnoses (diagnosis_id, created_at, diagnoses (id, name_ar, code))',
        )
        .in('clinic_type', [...CLINIC_TYPES])
        .eq('service_date', todayAdenYMD())
        .order('created_at', { ascending: true })

      if (clinicFilter !== 'all') {
        q = q.eq('clinic_type', clinicFilter)
      }
      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter)
      } else {
        q = q.in('status', ['waiting', 'called', 'in_service'])
      }

      const { data, error } = await q
      if (error) {
        console.error(error)
        toast.error(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as QueueWithRelations[])
    } finally {
      setLoading(false)
    }
  }, [clinicFilter, statusFilter])

  const onPanelUpdated = useCallback(() => {
    void loadQueues()
  }, [loadQueues])

  useEffect(() => {
    void loadQueues()
  }, [loadQueues])

  useEffect(() => {
    const ch = supabase
      .channel('clinic-queues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, () => {
        void loadQueues()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [loadQueues])

  useEffect(() => {
    const ch = supabase
      .channel('clinic-queue-diagnoses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_diagnoses' }, () => {
        void loadQueues()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [loadQueues])

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  )

  useEffect(() => {
    if (selectedId && !rows.some((r) => r.id === selectedId)) {
      setSelectedId(null)
    }
  }, [rows, selectedId])

  useEffect(() => {
    if (!walkInDrawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWalkInDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [walkInDrawerOpen])

  async function registerWalkInAtClinic(e: FormEvent) {
    e.preventDefault()
    const name = walkIn.full_name.trim()
    if (!name) {
      toast.error('أدخل الاسم الكامل للمراجع')
      return
    }
    if (!walkIn.clinic_type) {
      toast.error('اختر العيادة التي يُسجَّل لها الدور')
      return
    }
    const clinicChosen = walkIn.clinic_type
    setWalkInSaving(true)
    try {
      const { data: patient, error: errPatient } = await supabase
        .from('patients')
        .insert({
          full_name: name,
          phone: walkIn.phone.trim() || null,
          national_id: walkIn.national_id.trim() || null,
          date_of_birth: walkIn.date_of_birth || null,
          gender: walkIn.gender || null,
        })
        .select('id')
        .single()

      if (errPatient || !patient) {
        toast.error(errPatient?.message ?? 'تعذر حفظ بيانات المراجع')
        return
      }

      const { data: queue, error: errQueue } = await supabase
        .from('queues')
        .insert({
          patient_id: patient.id,
          clinic_type: clinicChosen,
          status: 'waiting',
        })
        .select('id, queue_number')
        .single()

      if (errQueue || !queue) {
        toast.error(errQueue?.message ?? 'تعذر إنشاء دور للعيادة')
        return
      }

      toast.success(`تم التسجيل — رقم الدور ${queue.queue_number} (${CLINIC_LABELS[clinicChosen]})`)
      setWalkIn({
        full_name: '',
        phone: '',
        national_id: '',
        date_of_birth: '',
        gender: '',
        clinic_type: '',
      })
      setClinicFilter(clinicChosen)
      setStatusFilter('all')
      await loadQueues()
      setSelectedId(queue.id)
      setWalkInDrawerOpen(false)
    } finally {
      setWalkInSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Stethoscope className="h-7 w-7 shrink-0 text-teal-600 sm:h-8 sm:w-8" />
            مساحة العيادات
          </h1>
          <p className="mt-1 hidden text-slate-600 sm:block sm:max-w-2xl sm:text-[15px]">
            أدوار المرضى، الكشف، التشخيص، الوصفات، والتحويل للمخبر أو الإسعاف
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWalkInDrawerOpen(true)}
            className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-h-0 sm:self-start"
          >
            <UserPlus className="h-4 w-4" />
            تسجيل مراجع بدون حجز مسبق
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadQueues()}
            className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-h-0 sm:self-start"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث القائمة
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select
          label="العيادة"
          className="w-full sm:min-w-[200px] sm:max-w-xs"
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value as typeof clinicFilter)}
        >
          <option value="all">الكل</option>
          {CLINIC_TYPES.map((c) => (
            <option key={c} value={c}>
              {CLINIC_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select
          label="الحالة"
          className="w-full sm:min-w-[200px] sm:max-w-md"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">نشط (انتظار / استدعاء / كشف)</option>
          <option value="waiting">في الانتظار</option>
          <option value="called">تم الاستدعاء</option>
          <option value="in_service">قيد الكشف</option>
          <option value="completed">مكتمل</option>
        </Select>
      </div>

      {/* درج جانبي: تسجيل مراجع بدون حجز مسبق */}
      <div
        className={`fixed inset-0 z-[100] transition-[visibility] duration-300 ${walkInDrawerOpen ? 'visible' : 'invisible pointer-events-none'}`}
        aria-hidden={!walkInDrawerOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-900/50 transition-opacity duration-300 ${walkInDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
          aria-label="إغلاق اللوحة"
          onClick={() => setWalkInDrawerOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="walk-in-drawer-title"
          className={`absolute top-0 bottom-0 z-[101] flex w-full max-w-md flex-col border-s border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ltr:right-0 rtl:left-0 ${
            walkInDrawerOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-teal-950/[0.04] px-4 py-4">
            <div className="min-w-0">
              <h2 id="walk-in-drawer-title" className="text-lg font-bold text-slate-900">
                مراجع بدون حجز مسبق
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                تسجيل عند الحضور وإصدار رقم دور اليوم للعيادة المختارة.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 px-2"
              aria-label="إغلاق"
              onClick={() => setWalkInDrawerOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <form onSubmit={(ev) => void registerWalkInAtClinic(ev)} className="grid gap-3">
              <Select
                label="العيادة المطلوبة"
                value={walkIn.clinic_type}
                onChange={(e) =>
                  setWalkIn((w) => ({ ...w, clinic_type: e.target.value as ClinicTypeValue | '' }))
                }
                required
              >
                <option value="">— اختر العيادة —</option>
                {CLINIC_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {CLINIC_LABELS[c]}
                  </option>
                ))}
              </Select>
              <Input
                label="الاسم الكامل"
                value={walkIn.full_name}
                onChange={(e) => setWalkIn((w) => ({ ...w, full_name: e.target.value }))}
                placeholder="كما سيظهر في النظام والصيدلية"
                required
                autoComplete="name"
              />
              <Input
                label="رقم الجوال"
                value={walkIn.phone}
                onChange={(e) => setWalkIn((w) => ({ ...w, phone: e.target.value }))}
                placeholder="اختياري"
                dir="ltr"
                className="text-end"
              />
              <Input
                label="رقم الهوية / بطاقة"
                value={walkIn.national_id}
                onChange={(e) => setWalkIn((w) => ({ ...w, national_id: e.target.value }))}
                placeholder="اختياري"
                dir="ltr"
                className="text-end"
              />
              <Input
                label="تاريخ الميلاد"
                type="date"
                value={walkIn.date_of_birth}
                onChange={(e) => setWalkIn((w) => ({ ...w, date_of_birth: e.target.value }))}
              />
              <Select
                label="الجنس"
                value={walkIn.gender}
                onChange={(e) => setWalkIn((w) => ({ ...w, gender: e.target.value }))}
              >
                <option value="">— غير محدد —</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </Select>
              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="submit"
                  disabled={walkInSaving}
                  className="min-h-11 w-full touch-manipulation gap-2"
                >
                  <UserPlus className="h-4 w-4" />
                  {walkInSaving ? 'جاري التسجيل…' : 'تسجيل المراجع وإصدار رقم الدور'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full touch-manipulation"
                  onClick={() => setWalkInDrawerOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </aside>
      </div>

      {loading ? (
        <p className="text-slate-500">جاري التحميل…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* على الهاتف: إما القائمة أو التفاصيل بملء العرض لتفادي التمرير المزدوج */}
          <div className={selectedId ? 'hidden lg:block' : 'block'}>
            <Card title="قائمة الأدوار">
              {rows.length === 0 ? (
                <p className="text-slate-500">لا توجد حالات مطابقة للفلتر.</p>
              ) : (
                <>
                  <div className="space-y-2 lg:hidden">
                    {rows.map((r) => {
                      const active = selectedId === r.id
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`w-full rounded-xl border px-4 py-3 text-start shadow-sm transition touch-manipulation active:bg-slate-50 ${
                            active
                              ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-200'
                              : 'border-slate-200 bg-white hover:border-teal-200 hover:bg-teal-50/40'
                          }`}
                          onClick={() => setSelectedId(r.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-slate-900">
                                {r.patients?.full_name ?? '—'}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-600">{clinicTypeLabel(r.clinic_type)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xl font-black tabular-nums text-teal-800">
                                {r.queue_number}
                              </span>
                              <Badge
                                tone={
                                  r.status === 'waiting'
                                    ? 'warning'
                                    : r.status === 'in_service'
                                      ? 'info'
                                      : 'default'
                                }
                              >
                                {queueStatusLabel(r.status)}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div className="hidden lg:block">
                    <Table>
                      <THead>
                        <Tr>
                          <Th>الرقم</Th>
                          <Th>المريض</Th>
                          <Th>العيادة</Th>
                          <Th>الحالة</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {rows.map((r) => (
                          <Tr
                            key={r.id}
                            className={`cursor-pointer touch-manipulation ${selectedId === r.id ? 'bg-teal-50' : ''}`}
                            onClick={() => setSelectedId(r.id)}
                            role="button"
                          >
                            <Td className="font-bold text-teal-800">{r.queue_number}</Td>
                            <Td>{r.patients?.full_name ?? '—'}</Td>
                            <Td>{clinicTypeLabel(r.clinic_type)}</Td>
                            <Td>
                              <Badge
                                tone={
                                  r.status === 'waiting'
                                    ? 'warning'
                                    : r.status === 'in_service'
                                      ? 'info'
                                      : 'default'
                                }
                              >
                                {queueStatusLabel(r.status)}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className={`space-y-4 ${selectedId ? 'block' : 'hidden lg:block'}`}>
            {selected ? (
              <ClinicDetailPanel
                row={selected}
                onUpdated={onPanelUpdated}
                onNavigateBack={() => setSelectedId(null)}
              />
            ) : (
              <Card title="تفاصيل الزيارة">
                <p className="text-slate-500">اختر صفاً من القائمة لعرض بيانات المريض وإجراءات الكشف.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ClinicDetailPanel({
  row,
  onUpdated,
  onNavigateBack,
}: {
  row: QueueWithRelations
  onUpdated: () => void
  /** للهاتف: العودة إلى قائمة الأدوار */
  onNavigateBack?: () => void
}) {
  const p = row.patients
  const [diagQuery, setDiagQuery] = useState('')
  const [diagHits, setDiagHits] = useState<Diagnosis[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [medHits, setMedHits] = useState<Medication[]>([])
  const [rxList, setRxList] = useState<RxWithMed[]>([])
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [rxForm, setRxForm] = useState({
    medication_id: '',
    dosage: '',
    frequency: '',
    duration: '',
  })
  const [busy, setBusy] = useState(false)
  /** قائمة احتياطية عندما لا يُرجع البحث نتائج (مثلاً ترميز الاسم) */
  const [medCatalog, setMedCatalog] = useState<Medication[]>([])
  const [labPickerOpen, setLabPickerOpen] = useState(false)
  const [selectedLabIds, setSelectedLabIds] = useState<Set<string>>(() => new Set())

  const loadRx = useCallback(async () => {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, medications!prescriptions_medication_id_fkey(*)')
      .eq('queue_id', row.id)
      .order('created_at', { ascending: false })
    if (error) {
      console.error(error)
      toast.error(error.message)
      setRxList([])
      return
    }
    setRxList((data ?? []) as RxWithMed[])
  }, [row.id])

  const loadRef = useCallback(async () => {
    const { data } = await supabase.from('referrals').select('*').eq('queue_id', row.id)
    setReferrals((data ?? []) as Referral[])
  }, [row.id])

  useEffect(() => {
    void loadRx()
    void loadRef()
  }, [loadRx, loadRef])

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('medications').select('*').order('name').limit(500)
      if (error) {
        console.error(error)
        return
      }
      setMedCatalog((data ?? []) as Medication[])
    })()
  }, [])

  useEffect(() => {
    const ch = supabase
      .channel(`clinic-rx-${row.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prescriptions', filter: `queue_id=eq.${row.id}` },
        () => {
          void loadRx()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [row.id, loadRx])

  useEffect(() => {
    const ch = supabase
      .channel(`clinic-qd-${row.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'queue_diagnoses', filter: `queue_id=eq.${row.id}` },
        () => {
          onUpdated()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [row.id, onUpdated])

  useEffect(() => {
    const ch = supabase
      .channel(`clinic-referrals-${row.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'referrals', filter: `queue_id=eq.${row.id}` },
        () => {
          void loadRef()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [row.id, loadRef])

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!diagQuery.trim()) {
          setDiagHits([])
          return
        }
        const { data } = await supabase
          .from('diagnoses')
          .select('*')
          .ilike('name_ar', `%${diagQuery.trim()}%`)
          .limit(15)
        setDiagHits((data ?? []) as Diagnosis[])
      })()
    }, 280)
    return () => clearTimeout(t)
  }, [diagQuery])

  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        if (!medQuery.trim()) {
          setMedHits([])
          return
        }
        const { data } = await supabase
          .from('medications')
          .select('*')
          .ilike('name', `%${medQuery.trim()}%`)
          .limit(15)
        setMedHits((data ?? []) as Medication[])
      })()
    }, 280)
    return () => clearTimeout(t)
  }, [medQuery])

  async function setStatus(status: Queue['status']) {
    setBusy(true)
    try {
      const { error } = await supabase
        .from('queues')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم تحديث الحالة')
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  const linkedDiagnoses = row.queue_diagnoses ?? []

  async function assignDiagnosis(d: Diagnosis) {
    if (linkedDiagnoses.some((x) => x.diagnosis_id === d.id)) {
      toast.error('هذا التشخيص مضاف مسبقاً لهذه الزيارة')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('queue_diagnoses').insert({
        queue_id: row.id,
        diagnosis_id: d.id,
      })
      if (error) {
        if (
          error.message.includes('queue_diagnoses') ||
          error.code === 'PGRST204' ||
          error.code === '42P01'
        ) {
          toast.error('جدول queue_diagnoses غير موجود. نفّذ supabase/patch_queue_diagnoses.sql أو حدّث schema.sql')
        } else if (error.code === '23505') {
          toast.error('هذا التشخيص مضاف مسبقاً')
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success(`أُضيف التشخيص: ${d.name_ar}`)
      setDiagQuery('')
      setDiagHits([])
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function removeDiagnosis(diagnosisId: string) {
    if (!confirm('إزالة هذا التشخيص من الزيارة؟')) return
    setBusy(true)
    try {
      const { error } = await supabase
        .from('queue_diagnoses')
        .delete()
        .eq('queue_id', row.id)
        .eq('diagnosis_id', diagnosisId)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تمت إزالة التشخيص')
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  async function addPrescription() {
    const dosage = rxForm.dosage.trim()
    const frequency = rxForm.frequency.trim()
    const duration = rxForm.duration.trim()
    if (!rxForm.medication_id) {
      toast.error('اختر دواء من القائمة أو من القائمة المنسدلة')
      return
    }
    if (!dosage || !frequency || !duration) {
      toast.error('أكمل الجرعة والتكرار والمدة (نصوص غير فارغة)')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          queue_id: row.id,
          medication_id: rxForm.medication_id,
          dosage,
          frequency,
          duration,
        })
        .select('id')
        .maybeSingle()
      if (error) {
        const msg = error.message || ''
        if (msg.includes('row-level security') || msg.includes('RLS')) {
          toast.error('الصلاحيات تمنع إضافة الوصفة. تأكد أن دورك «عيادة» أو «مسؤول» في جدول profiles.')
        } else if (msg.includes('foreign key') || msg.includes('23503')) {
          toast.error('معرّف الدواء غير صالح أو حُذف من قائمة الأدوية. اختر دواءً من القائمة من جديد.')
        } else {
          toast.error(msg || 'تعذر حفظ الوصفة')
        }
        return
      }
      if (!data?.id) {
        toast.error('لم يُؤكَّد حفظ الوصفة. تحقق من سياسات RLS لجدول prescriptions (إدراج للعيادة).')
        return
      }
      toast.success('أُضيفت الوصفة')
      setRxForm({ medication_id: '', dosage: '', frequency: '', duration: '' })
      setMedQuery('')
      setMedHits([])
      await loadRx()
    } finally {
      setBusy(false)
    }
  }

  function openLabReferralPicker() {
    const exists = referrals.some((r) => r.department === 'lab' && r.status !== 'completed')
    if (exists) {
      toast.error('يوجد تحويل للمخبر لم يُغلق بعد')
      return
    }
    setSelectedLabIds(new Set())
    setLabPickerOpen(true)
  }

  function toggleLabTestId(id: string) {
    setSelectedLabIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submitLabReferral() {
    const exists = referrals.some((r) => r.department === 'lab' && r.status !== 'completed')
    if (exists) {
      toast.error('يوجد تحويل للمخبر لم يُغلق بعد')
      return
    }
    if (selectedLabIds.size === 0) {
      toast.error('اختر تحليلاً واحداً على الأقل من القائمة المعتمدة')
      return
    }
    setBusy(true)
    try {
      const labels = labelsFromLabTestIds(selectedLabIds)
      const { error } = await supabase.from('referrals').insert({
        queue_id: row.id,
        department: 'lab',
        from_department: 'clinic',
        status: 'pending',
        requested_lab_tests: labels,
      })
      if (error) {
        const msg = error.message || ''
        if (msg.includes('requested_lab_tests') || error.code === 'PGRST204') {
          toast.error(
            'عمود التحاليل غير مُعدّ في قاعدة البيانات. نفّذ الملف supabase/patch_referrals_lab_tests.sql في SQL Editor.',
          )
        } else {
          toast.error(msg || 'تعذر إرسال الطلب')
        }
        return
      }
      toast.success('أُرسل طلب المخبر مع قائمة التحاليل المحددة')
      setLabPickerOpen(false)
      setSelectedLabIds(new Set())
      void loadRef()
    } finally {
      setBusy(false)
    }
  }

  async function createErReferral() {
    const exists = referrals.some((r) => r.department === 'er' && r.status !== 'completed')
    if (exists) {
      toast.error('يوجد تحويل لهذا القسم لم يُغلق بعد')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.from('referrals').insert({
        queue_id: row.id,
        department: 'er',
        from_department: 'clinic',
        status: 'pending',
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('أُرسل تحويل للإسعاف')
      void loadRef()
    } finally {
      setBusy(false)
    }
  }

  const latestLabReferral =
    [...referrals]
      .filter((r) => r.department === 'lab')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null

  const latestErReferral =
    [...referrals]
      .filter((r) => r.department === 'er')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null

  return (
    <>
      {onNavigateBack ? (
        <div className="sticky top-0 z-20 -mx-1 mb-4 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-sm sm:-mx-0 lg:hidden">
          <Button
            type="button"
            variant="secondary"
            className="min-h-12 w-full touch-manipulation gap-2 text-base font-semibold"
            onClick={onNavigateBack}
          >
            <List className="h-5 w-5 shrink-0" />
            العودة إلى قائمة الأدوار
          </Button>
        </div>
      ) : null}
      <Card title={`زيارة — رقم الدور ${row.queue_number}`}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {row.status === 'waiting' ? (
            <Button
              type="button"
              disabled={busy}
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={() => void setStatus('called')}
            >
              استدعاء المريض
            </Button>
          ) : null}
          {row.status === 'called' ? (
            <Button
              type="button"
              disabled={busy}
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={() => void setStatus('in_service')}
            >
              بدء الكشف
            </Button>
          ) : null}
          {row.status === 'in_service' ? (
            <Button
              type="button"
              disabled={busy}
              variant="secondary"
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={() => void setStatus('completed')}
            >
              إنهاء الزيارة
            </Button>
          ) : null}
        </div>
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-slate-900">
            <User className="h-4 w-4 text-teal-700" />
            بيانات المريض (للعرض)
          </p>
          {p ? (
            <>
              <p className="text-slate-900">{p.full_name}</p>
              {p.phone ? (
                <p className="flex items-center gap-2 text-slate-600" dir="ltr">
                  {p.phone}
                </p>
              ) : null}
              <p className="text-slate-600">الهوية: {p.national_id ?? '—'}</p>
              {p.date_of_birth ? (
                <p className="text-slate-600">تاريخ الميلاد: {p.date_of_birth}</p>
              ) : null}
              {p.gender ? (
                <p className="text-slate-600">
                  الجنس: {p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : p.gender}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-amber-800">
              لم تُحمّل بيانات المريض من النظام. إن كان المراجع لم يُسجَّل بعد، استخدم زر «تسجيل مراجع بدون حجز مسبق»
              في أعلى الصفحة لفتح نموذج التسجيل.
            </p>
          )}
          <p className="border-t border-slate-200 pt-2 text-xs text-slate-500">
            وقت إنشاء الدور: {formatDateTime(row.created_at)}
          </p>
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">التشخيصات المرتبطة</p>
          {linkedDiagnoses.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {linkedDiagnoses.map((x) => (
                <li
                  key={x.diagnosis_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900"
                >
                  <span>{x.diagnoses?.name_ar ?? '—'}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    className="text-xs"
                    onClick={() => void removeDiagnosis(x.diagnosis_id)}
                  >
                    إزالة
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-amber-800">لم يُضف تشخيص بعد — يمكنك إضافة أكثر من تشخيص لنفس الزيارة</p>
          )}
        </div>
      </Card>

      <Card title="بحث وإضافة تشخيص (عدة تشخيصات مسموحة)">
        <Input
          label="ابحث بالاسم (عربي)"
          value={diagQuery}
          onChange={(e) => setDiagQuery(e.target.value)}
          placeholder="مثال: ضغط، سكري…"
        />
        {diagHits.length > 0 ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded border border-slate-200">
            {diagHits.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 w-full touch-manipulation border-b border-slate-100 px-3 py-3 text-start text-sm hover:bg-teal-50"
                  onClick={() => void assignDiagnosis(d)}
                >
                  {d.name_ar}
                  {d.code ? <span className="text-slate-400"> — {d.code}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="وصفات طبية — يمكن إضافة عدة أدواء لنفس الزيارة">
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Select
              label="اختيار دواء (قائمة كاملة)"
              value={rxForm.medication_id}
              onChange={(e) => {
                const id = e.target.value
                const m = medCatalog.find((x) => x.id === id)
                setRxForm((f) => ({
                  ...f,
                  medication_id: id,
                  dosage: m?.default_dosage?.trim() ? m.default_dosage : f.dosage,
                }))
                setMedQuery(m?.name ?? '')
                setMedHits([])
              }}
            >
              <option value="">— اختر دواءً —</option>
              {medCatalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.form ? ` (${m.form})` : ''}
                </option>
              ))}
            </Select>
            {medCatalog.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800">
                لا توجد أدوية في النظام. أضف أدوية من لوحة الإدارة → البيانات المرجعية، ثم حدّث الصفحة.
              </p>
            ) : null}
            <div className="mt-4">
              <Input
                label="أو ابحث بالاسم"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="اسم الدواء…"
              />
            </div>
            {medHits.length > 0 ? (
              <ul className="mt-1 max-h-32 overflow-auto rounded border border-slate-200">
                {medHits.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full touch-manipulation border-b border-slate-100 px-3 py-3 text-start text-sm hover:bg-teal-50"
                      onClick={() => {
                        setRxForm((f) => ({
                          ...f,
                          medication_id: m.id,
                          dosage: m.default_dosage?.trim() ? (m.default_dosage ?? '') : f.dosage,
                        }))
                        setMedQuery(m.name)
                        setMedHits([])
                      }}
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Input
            label="الجرعة"
            value={rxForm.dosage}
            onChange={(e) => setRxForm((f) => ({ ...f, dosage: e.target.value }))}
          />
          <Input
            label="التكرار"
            value={rxForm.frequency}
            onChange={(e) => setRxForm((f) => ({ ...f, frequency: e.target.value }))}
            placeholder="مثال: 3 مرات يومياً"
          />
          <Input
            label="المدة"
            value={rxForm.duration}
            onChange={(e) => setRxForm((f) => ({ ...f, duration: e.target.value }))}
            placeholder="مثال: 7 أيام"
            className="sm:col-span-2"
          />
          <Button
            type="button"
            disabled={busy || !rxForm.medication_id}
            className="min-h-11 w-full touch-manipulation sm:w-auto"
            onClick={() => void addPrescription()}
          >
            إضافة للوصفة
          </Button>
        </div>
        {rxList.length === 0 ? (
          <p className="text-sm text-slate-500">لا وصفات بعد لهذه الزيارة.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الدواء</Th>
                <Th>الجرعة</Th>
                <Th>التكرار</Th>
                <Th>المدة</Th>
                <Th>الصرف</Th>
              </Tr>
            </THead>
            <TBody>
              {rxList.map((rx) => (
                <Tr key={rx.id}>
                  <Td>{rx.medications?.name ?? '—'}</Td>
                  <Td>{rx.dosage}</Td>
                  <Td>{rx.frequency}</Td>
                  <Td>{rx.duration}</Td>
                  <Td>{rx.dispensed ? <Badge tone="success">تم</Badge> : <Badge>لا</Badge>}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card title="تحويل — المخبر والإسعاف">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || referrals.some((r) => r.department === 'lab' && r.status !== 'completed')}
            className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto"
            onClick={() => openLabReferralPicker()}
          >
            <FlaskConical className="h-4 w-4" />
            طلب تحاليل من المخبر
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto"
            onClick={() => void createErReferral()}
          >
            <Siren className="h-4 w-4" />
            تحويل للإسعاف
          </Button>
        </div>
        {labPickerOpen ? (
          <div className="mt-4 rounded-xl border border-teal-200 bg-gradient-to-b from-teal-50/60 to-white p-4 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-slate-900">اختر التحاليل المطلوبة</p>
            <p className="mb-3 text-xs text-slate-600">
              القائمة مطابقة للتحاليل المعتمدة؛ يستلمها المخبر ويُعيد النتائج عند الإكمال.
            </p>
            <div className="grid max-h-[min(50vh,22rem)] gap-2 overflow-y-auto sm:grid-cols-2">
              {LAB_TEST_CATALOG.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-teal-300 hover:bg-teal-50/40"
                >
                  <input
                    type="checkbox"
                    checked={selectedLabIds.has(t.id)}
                    onChange={() => toggleLabTestId(t.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="font-medium text-slate-800">{t.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={busy}
                onClick={() =>
                  setSelectedLabIds(new Set(LAB_TEST_CATALOG.map((x) => x.id)))
                }
              >
                تحديد الكل
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={busy}
                onClick={() => setSelectedLabIds(new Set())}
              >
                إلغاء الكل
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2 border-t border-teal-100 pt-4 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                disabled={busy}
                className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto"
                onClick={() => void submitLabReferral()}
              >
                <FlaskConical className="h-4 w-4" />
                إرسال الطلب للمخبر
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                className="min-h-11 w-full touch-manipulation sm:w-auto"
                onClick={() => {
                  setLabPickerOpen(false)
                  setSelectedLabIds(new Set())
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-4 space-y-3">
          {latestLabReferral ? (
            <div
              className={`rounded-xl border px-4 py-3 ${
                latestLabReferral.status === 'completed'
                  ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50/80'
                  : latestLabReferral.status === 'in_progress'
                    ? 'border-sky-300 bg-sky-50/90'
                    : 'border-amber-200 bg-amber-50/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <FlaskConical className="h-5 w-5 text-teal-700" />
                  حالة المخبر
                </p>
                <Badge
                  tone={
                    latestLabReferral.status === 'completed'
                      ? 'success'
                      : latestLabReferral.status === 'in_progress'
                        ? 'info'
                        : 'warning'
                  }
                >
                  {referralStatusLabel(latestLabReferral.status)}
                </Badge>
              </div>
              <div className="mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">التحاليل المطلوبة</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {parseRequestedLabTests(latestLabReferral.requested_lab_tests).length === 0 ? (
                    <span className="text-sm text-slate-500">لا توجد قائمة محفوظة (طلب قديم أو قبل التحديث).</span>
                  ) : (
                    parseRequestedLabTests(latestLabReferral.requested_lab_tests).map((t) => (
                      <Badge key={t} tone="info" className="text-[11px]">
                        {t}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
              {latestLabReferral.status === 'completed' ? (
                <>
                  <p className="mt-3 text-sm text-emerald-900">
                    اكتمل طلب المخبر — يمكنكم متابعة العلاج أو الوصفات حسب النتائج أدناه.
                  </p>
                  {latestLabReferral.lab_results?.trim() ? (
                    <div className="mt-3 rounded-lg border border-emerald-200/80 bg-white/90 p-3 shadow-inner">
                      <p className="mb-1 text-xs font-semibold text-emerald-900">نتائج المخبر</p>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {latestLabReferral.lab_results.trim()}
                      </pre>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-amber-800">لم يُسجَّل نص نتائج في النظام.</p>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-700">
                  {latestLabReferral.status === 'pending'
                    ? 'الطلب في انتظار تنفيذ المخبر.'
                    : 'المخبر يعمل حالياً على هذا الطلب.'}
                </p>
              )}
              {referrals.filter((r) => r.department === 'lab').length > 1 ? (
                <p className="mt-2 text-xs text-slate-500">
                  يوجد أكثر من طلب مخبر؛ يُعرض أحدث طلب. الإجمالي:{' '}
                  {referrals.filter((r) => r.department === 'lab').length}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">لا يوجد تحويل للمخبر لهذا الدور بعد.</p>
          )}
          {latestErReferral ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Siren className="h-4 w-4 text-rose-600" />
                تحويل الإسعاف
              </p>
              <Badge
                tone={
                  latestErReferral.status === 'completed'
                    ? 'success'
                    : latestErReferral.status === 'in_progress'
                      ? 'info'
                      : 'warning'
                }
              >
                {referralStatusLabel(latestErReferral.status)}
              </Badge>
            </div>
          ) : null}
        </div>
      </Card>
    </>
  )
}
