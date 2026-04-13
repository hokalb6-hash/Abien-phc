import { Fragment, useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Patient, Queue, Referral } from '../../types/db'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatDateTime, queueStatusLabel } from '../../utils/format'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { parseRequestedLabTests } from '../../constants/labTests'

type ReferralRow = Referral & {
  queues:
    | (Queue & {
        patients: Pick<Patient, 'id' | 'full_name' | 'phone'> | null
      })
    | null
}

const statusTone: Record<Referral['status'], 'warning' | 'info' | 'success'> = {
  pending: 'warning',
  in_progress: 'info',
  completed: 'success',
}

const referralStatusAr: Record<Referral['status'], string> = {
  pending: 'معلق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
}

export function ReferralsDepartmentWorkspace({
  department,
  title,
  subtitle,
  /** إن وُجدت (مثل الإسعاف): لا يُسمح بالإكمال دون اختيار خدمة؛ تُحفظ في `referrals.service_provided` */
  completionServiceCatalog,
  /** للمخبر: إلزام إدخال نص النتائج قبل الإكمال */
  requireLabResultsOnComplete = false,
}: {
  department: 'lab' | 'er'
  title: string
  subtitle: string
  completionServiceCatalog?: readonly string[]
  requireLabResultsOnComplete?: boolean
}) {
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [servicePick, setServicePick] = useState<Record<string, string>>({})
  const [labResultsDraft, setLabResultsDraft] = useState<Record<string, string>>({})
  const [walkInName, setWalkInName] = useState('')
  const [walkInPhone, setWalkInPhone] = useState('')
  const [walkInSaving, setWalkInSaving] = useState(false)

  const requireServiceToComplete = Boolean(completionServiceCatalog?.length)
  const isLab = department === 'lab'
  const tableColCount = 7 + (requireServiceToComplete ? 1 : 0) + (isLab ? 1 : 0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('*, queues!inner (*, patients (id, full_name, phone))')
        .eq('department', department)
        .eq('queues.service_date', todayAdenYMD())
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        toast.error(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as ReferralRow[])
    } finally {
      setLoading(false)
    }
  }, [department])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ch = supabase
      .channel(`referrals-${department}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [department, load])

  async function setStatus(id: string, status: Referral['status']) {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('referrals')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم تحديث حالة التحويل')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function markCompleted(id: string) {
    const service = servicePick[id]?.trim() ?? ''
    if (requireServiceToComplete) {
      if (!service) {
        toast.error('اختر الخدمة المقدّمة قبل إكمال ملف المريض')
        return
      }
      if (completionServiceCatalog && !completionServiceCatalog.includes(service)) {
        toast.error('الخدمة المختارة غير معتمدة في القائمة')
        return
      }
    }
    if (isLab && requireLabResultsOnComplete) {
      const results = (labResultsDraft[id] ?? '').trim()
      if (!results) {
        toast.error('أدخل نتائج التحاليل (نصاً) قبل إكمال الطلب')
        return
      }
    }
    setBusyId(id)
    try {
      const payload: {
        status: Referral['status']
        updated_at: string
        service_provided?: string
        lab_results?: string
      } = {
        status: 'completed',
        updated_at: new Date().toISOString(),
      }
      if (requireServiceToComplete && service) {
        payload.service_provided = service
      }
      if (isLab && requireLabResultsOnComplete) {
        payload.lab_results = (labResultsDraft[id] ?? '').trim()
      }
      const { error } = await supabase.from('referrals').update(payload).eq('id', id)
      if (error) {
        if (error.message.includes('service_provided') || error.code === 'PGRST204') {
          toast.error('عمود service_provided غير موجود. نفّذ supabase/patch_referrals_service.sql في Supabase')
        } else if (error.message.includes('lab_results') || error.code === 'PGRST204') {
          toast.error('عمود lab_results غير موجود. نفّذ supabase/patch_referrals_lab_tests.sql في Supabase')
        } else {
          toast.error(error.message)
        }
        return
      }
      toast.success('تم إكمال التحويل')
      setServicePick((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setLabResultsDraft((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function registerWalkIn(e: FormEvent) {
    e.preventDefault()
    if (department !== 'er') return
    const name = walkInName.trim()
    if (!name) {
      toast.error('أدخل اسم المريض')
      return
    }
    setWalkInSaving(true)
    try {
      const { data: patient, error: errPatient } = await supabase
        .from('patients')
        .insert({
          full_name: name,
          phone: walkInPhone.trim() || null,
        })
        .select('id')
        .single()

      if (errPatient || !patient) {
        toast.error(errPatient?.message ?? 'تعذر حفظ بيانات المريض')
        return
      }

      const { data: queue, error: errQueue } = await supabase
        .from('queues')
        .insert({
          patient_id: patient.id,
          clinic_type: 'er',
          status: 'waiting',
        })
        .select('id')
        .single()

      if (errQueue || !queue) {
        toast.error(errQueue?.message ?? 'تعذر إنشاء دور الزيارة')
        return
      }

      const { error: errRef } = await supabase.from('referrals').insert({
        queue_id: queue.id,
        department: 'er',
        from_department: 'direct',
        status: 'pending',
      })

      if (errRef) {
        toast.error(errRef.message)
        return
      }

      toast.success('تم تسجيل الزيارة المباشرة — يمكنك اختيار الخدمة وإكمال الملف من الجدول')
      setWalkInName('')
      setWalkInPhone('')
      void load()
    } finally {
      setWalkInSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-1 hidden text-slate-600 sm:block sm:max-w-2xl sm:text-[15px]">{subtitle}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void load()}
          className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto sm:min-h-0 sm:self-start"
        >
          <RefreshCw className="h-4 w-4" />
          تحديث
        </Button>
      </header>

      {department === 'er' ? (
        <Card title="زيارة مباشرة للإسعاف (بدون تحويل من العيادة)">
          <p className="mb-4 text-sm text-slate-600">
            للمراجع الذي حضر مباشرة إلى الطوارئ دون أن يمرّ بدور العيادات: سجّل اسمه ثم اختر الخدمة المقدّمة وأكمل الملف من
            الجدول أدناه كأي تحويل.
          </p>
          <form onSubmit={(ev) => void registerWalkIn(ev)} className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <Input
              label="اسم المريض"
              name="walk_in_name"
              value={walkInName}
              onChange={(ev) => setWalkInName(ev.target.value)}
              className="w-full min-w-0 sm:min-w-[200px] sm:flex-1"
              required
              autoComplete="name"
            />
            <Input
              label="رقم الجوال (اختياري)"
              name="walk_in_phone"
              type="tel"
              value={walkInPhone}
              onChange={(ev) => setWalkInPhone(ev.target.value)}
              dir="ltr"
              className="w-full sm:w-48"
            />
            <Button
              type="submit"
              disabled={walkInSaving}
              className="min-h-11 w-full touch-manipulation shrink-0 sm:w-auto"
            >
              {walkInSaving ? 'جاري التسجيل…' : 'تسجيل الزيارة وإضافتها للقائمة'}
            </Button>
          </form>
        </Card>
      ) : null}

      <Card title="التحويلات الواردة">
        {loading ? (
          <p className="text-slate-500">جاري التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">لا توجد تحويلات حالياً.</p>
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {rows.map((r) => {
                const q = r.queues
                const p = q?.patients
                const b = busyId === r.id
                const requested = parseRequestedLabTests(r.requested_lab_tests)
                return (
                  <div
                    key={`m-${r.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">{p?.full_name ?? '—'}</p>
                        <p className="mt-1 text-sm text-slate-600">{q ? clinicTypeLabel(q.clinic_type) : '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(r.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-lg font-black tabular-nums text-teal-800">
                          {q?.queue_number ?? '—'}
                        </span>
                        <Badge tone={statusTone[r.status]}>{referralStatusAr[r.status]}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      حالة الدور: <span className="font-medium text-slate-700">{q ? queueStatusLabel(q.status) : '—'}</span>
                    </p>
                    {isLab ? (
                      <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
                        <div>
                          <p className="mb-1 text-xs font-semibold text-slate-600">التحاليل المطلوبة</p>
                          <div className="flex flex-wrap gap-1">
                            {requested.length === 0 ? (
                              <span className="text-sm text-slate-500">—</span>
                            ) : (
                              requested.map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-900"
                                >
                                  {t}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                        <div>
                          <label htmlFor={`m-lab-${r.id}`} className="mb-1 block text-xs font-semibold text-slate-600">
                            نتائج التحاليل
                          </label>
                          {r.status === 'completed' ? (
                            <pre
                              id={`m-lab-${r.id}`}
                              className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-sm text-slate-800"
                            >
                              {r.lab_results?.trim() || '—'}
                            </pre>
                          ) : (
                            <textarea
                              id={`m-lab-${r.id}`}
                              className="min-h-[100px] w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                              placeholder="اكتب النتائج…"
                              value={
                                labResultsDraft[r.id] !== undefined
                                  ? labResultsDraft[r.id]
                                  : (r.lab_results ?? '')
                              }
                              onChange={(e) =>
                                setLabResultsDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                              disabled={b}
                            />
                          )}
                        </div>
                      </div>
                    ) : null}
                    {requireServiceToComplete ? (
                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-semibold text-slate-600">الخدمة المقدّمة</label>
                        {r.status === 'completed' ? (
                          <p className="text-sm text-slate-800">{r.service_provided ?? '—'}</p>
                        ) : (
                          <Select
                            aria-label={`خدمة ${p?.full_name ?? r.id}`}
                            className="text-sm"
                            value={servicePick[r.id] ?? ''}
                            onChange={(e) =>
                              setServicePick((prev) => ({ ...prev, [r.id]: e.target.value }))
                            }
                          >
                            <option value="">— اختر الخدمة —</option>
                            {completionServiceCatalog?.map((label) => (
                              <option key={label} value={label}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    ) : null}
                    <div className="mt-4 flex flex-col gap-2">
                      {r.status === 'pending' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={b}
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() => void setStatus(r.id, 'in_progress')}
                        >
                          بدء
                        </Button>
                      ) : null}
                      {r.status === 'in_progress' ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={b}
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() => void markCompleted(r.id)}
                        >
                          إكمال
                        </Button>
                      ) : null}
                      {r.status === 'pending' && !requireServiceToComplete && !isLab ? (
                        <Button
                          type="button"
                          disabled={b}
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() => void markCompleted(r.id)}
                        >
                          إكمال مباشر
                        </Button>
                      ) : null}
                      {r.status === 'pending' && requireServiceToComplete ? (
                        <Button
                          type="button"
                          disabled={b}
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() => void markCompleted(r.id)}
                        >
                          إكمال الملف
                        </Button>
                      ) : null}
                      {r.status === 'pending' && isLab && !requireLabResultsOnComplete ? (
                        <Button
                          type="button"
                          disabled={b}
                          className="min-h-11 w-full touch-manipulation"
                          onClick={() => void markCompleted(r.id)}
                        >
                          إكمال مباشر
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden lg:block">
              <Table>
                <THead>
                  <Tr>
                    <Th>المريض</Th>
                    <Th>رقم الدور</Th>
                    <Th>العيادة</Th>
                    <Th>حالة الدور</Th>
                    <Th>حالة التحويل</Th>
                    {isLab ? <Th>التحاليل المطلوبة</Th> : null}
                    {requireServiceToComplete ? <Th>الخدمة المقدّمة</Th> : null}
                    <Th>الوقت</Th>
                    <Th>إجراءات</Th>
                  </Tr>
                </THead>
                <TBody>
              {rows.map((r) => {
                const q = r.queues
                const p = q?.patients
                const b = busyId === r.id
                const requested = parseRequestedLabTests(r.requested_lab_tests)
                return (
                  <Fragment key={r.id}>
                    <Tr className="touch-manipulation">
                      <Td>{p?.full_name ?? '—'}</Td>
                      <Td className="font-semibold text-teal-800">{q?.queue_number ?? '—'}</Td>
                      <Td>{q ? clinicTypeLabel(q.clinic_type) : '—'}</Td>
                      <Td>{q ? queueStatusLabel(q.status) : '—'}</Td>
                      <Td>
                        <Badge tone={statusTone[r.status]}>{referralStatusAr[r.status]}</Badge>
                      </Td>
                      {isLab ? (
                        <Td className="max-w-[220px] align-top">
                          <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                            {requested.length === 0 ? (
                              <span className="text-xs text-slate-400">—</span>
                            ) : (
                              requested.map((t) => (
                                <Badge key={t} tone="info" className="max-w-full truncate text-[10px]">
                                  {t}
                                </Badge>
                              ))
                            )}
                          </div>
                        </Td>
                      ) : null}
                      {requireServiceToComplete ? (
                        <Td className="max-w-[220px]">
                          {r.status === 'completed' ? (
                            <span className="text-sm text-slate-800">{r.service_provided ?? '—'}</span>
                          ) : (
                            <Select
                              aria-label={`خدمة المريض ${p?.full_name ?? r.id}`}
                              className="text-sm"
                              value={servicePick[r.id] ?? ''}
                              onChange={(e) =>
                                setServicePick((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                            >
                              <option value="">— اختر الخدمة —</option>
                              {completionServiceCatalog?.map((label) => (
                                <option key={label} value={label}>
                                  {label}
                                </option>
                              ))}
                            </Select>
                          )}
                        </Td>
                      ) : null}
                      <Td className="text-sm text-slate-600">{formatDateTime(r.created_at)}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {r.status === 'pending' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={b}
                              className="touch-manipulation px-2 py-1 text-xs sm:min-h-0"
                              onClick={() => void setStatus(r.id, 'in_progress')}
                            >
                              بدء
                            </Button>
                          ) : null}
                          {r.status === 'in_progress' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={b}
                              className="touch-manipulation px-2 py-1 text-xs sm:min-h-0"
                              onClick={() => void markCompleted(r.id)}
                            >
                              إكمال
                            </Button>
                          ) : null}
                          {r.status === 'pending' && !requireServiceToComplete && !isLab ? (
                            <Button
                              type="button"
                              disabled={b}
                              className="touch-manipulation px-2 py-1 text-xs sm:min-h-0"
                              onClick={() => void markCompleted(r.id)}
                            >
                              إكمال مباشر
                            </Button>
                          ) : null}
                          {r.status === 'pending' && requireServiceToComplete ? (
                            <Button
                              type="button"
                              disabled={b}
                              className="touch-manipulation px-2 py-1 text-xs sm:min-h-0"
                              onClick={() => void markCompleted(r.id)}
                            >
                              إكمال الملف
                            </Button>
                          ) : null}
                          {r.status === 'pending' && isLab && !requireLabResultsOnComplete ? (
                            <Button
                              type="button"
                              disabled={b}
                              className="touch-manipulation px-2 py-1 text-xs sm:min-h-0"
                              onClick={() => void markCompleted(r.id)}
                            >
                              إكمال مباشر
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                    {isLab ? (
                      <Tr className="bg-slate-50/95">
                        <Td colSpan={tableColCount} className="border-t-0 px-4 py-3">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                التحاليل المطلوبة من الطبيب
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {requested.length === 0 ? (
                                  <span className="text-sm text-slate-500">لم يُحدد طلب من القائمة المعتمدة.</span>
                                ) : (
                                  requested.map((t) => (
                                    <span
                                      key={t}
                                      className="rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-900"
                                    >
                                      {t}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor={`lab-results-${r.id}`}
                                className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                              >
                                نتائج التحاليل (تُرسل للعيادة عند الإكمال)
                              </label>
                              {r.status === 'completed' ? (
                                <pre
                                  id={`lab-results-${r.id}`}
                                  className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 shadow-inner"
                                >
                                  {r.lab_results?.trim() || '—'}
                                </pre>
                              ) : (
                                <textarea
                                  id={`lab-results-${r.id}`}
                                  className="min-h-[120px] w-full resize-y rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                                  placeholder="اكتب النتائج أو الملخص الطبي للتحاليل المطلوبة…"
                                  value={
                                    labResultsDraft[r.id] !== undefined
                                      ? labResultsDraft[r.id]
                                      : (r.lab_results ?? '')
                                  }
                                  onChange={(e) =>
                                    setLabResultsDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                                  }
                                  disabled={b}
                                />
                              )}
                            </div>
                          </div>
                        </Td>
                      </Tr>
                    ) : null}
                  </Fragment>
                )
              })}
                </TBody>
              </Table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
