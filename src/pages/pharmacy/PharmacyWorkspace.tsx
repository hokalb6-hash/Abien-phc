import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { CalendarClock, Package, Pill, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Medication, Patient, Prescription, Queue } from '../../types/db'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatDateTime } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

type RxRow = Prescription & {
  medications: Medication | null
  queues:
    | (Queue & {
        patients: Pick<Patient, 'id' | 'full_name' | 'phone' | 'national_id'> | null
      })
    | null
}

type RxGroup = {
  queueId: string
  queue: NonNullable<RxRow['queues']>
  patient: Pick<Patient, 'id' | 'full_name' | 'phone' | 'national_id'> | null
  items: RxRow[]
}

export default function PharmacyWorkspace() {
  const [rows, setRows] = useState<RxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          '*, medications!prescriptions_medication_id_fkey (id, name, form, unit, default_dosage), queues!inner (*, patients (id, full_name, phone, national_id))',
        )
        .eq('dispensed', false)
        .eq('queues.service_date', todayAdenYMD())
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) {
        toast.error(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as RxRow[])
    } finally {
      setLoading(false)
    }
  }, [])

  const groups = useMemo(() => {
    const map = new Map<string, RxRow[]>()
    for (const rx of rows) {
      const qid = rx.queue_id
      if (!map.has(qid)) map.set(qid, [])
      map.get(qid)!.push(rx)
    }
    const list: RxGroup[] = []
    for (const [queueId, items] of map) {
      const q = items[0]?.queues
      if (!q) continue
      list.push({
        queueId,
        queue: q,
        patient: q.patients ?? null,
        items: [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      })
    }
    list.sort((a, b) => a.queue.queue_number - b.queue.queue_number)
    return list
  }, [rows])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('pharmacy-rx')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'prescriptions' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [load])

  async function markDispensed(id: string) {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({
          dispensed: true,
          dispensed_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم تسجيل الصرف')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Pill className="h-7 w-7 shrink-0 text-teal-600 sm:h-8 sm:w-8" />
            الصيدلية
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            وصفات اليوم مجمّعة حسب زيارة المريض — عرض واضح للجرعات وجاهزية الصرف
          </p>
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

      <Card title="وصفات بانتظار الصرف">
        {loading ? (
          <p className="text-slate-500">جاري التحميل…</p>
        ) : groups.length === 0 ? (
          <p className="text-slate-500">لا توجد وصفات معلّقة.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <article
                key={g.queueId}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/80 shadow-sm"
              >
                <header className="flex flex-col gap-3 border-b border-slate-100 bg-teal-950/[0.03] px-3 py-3 sm:px-4 sm:py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-lg font-bold leading-snug text-slate-900 sm:truncate">
                      {g.patient?.full_name?.trim() || 'مريض — أضف الاسم من العيادة'}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                      {g.patient?.phone ? (
                        <span dir="ltr" className="font-medium text-slate-800">
                          {g.patient.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400">لا يوجد جوال</span>
                      )}
                      <span className="hidden text-slate-300 sm:inline" aria-hidden>
                        |
                      </span>
                      <span>{clinicTypeLabel(g.queue.clinic_type)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info" className="tabular-nums text-base font-bold tracking-wide">
                      دور {g.queue.queue_number}
                    </Badge>
                  </div>
                </header>
                <ul className="divide-y divide-slate-100 p-2 sm:p-3">
                  {g.items.map((rx) => {
                    const m = rx.medications
                    const b = busyId === rx.id
                    const meta = [m?.form, m?.unit].filter(Boolean).join(' · ')
                    return (
                      <li key={rx.id} className="py-3 first:pt-2 last:pb-2">
                        <div className="flex flex-col gap-4 rounded-xl border border-slate-100 bg-white p-4 sm:flex-row sm:items-stretch sm:justify-between">
                          <div className="flex min-w-0 flex-1 gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-inner shadow-teal-900/20"
                              aria-hidden
                            >
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              <p className="text-base font-bold leading-snug text-slate-900">{m?.name ?? '—'}</p>
                              {meta ? (
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{meta}</p>
                              ) : null}
                              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                                <div className="rounded-lg bg-slate-50 px-3 py-2">
                                  <dt className="text-xs font-medium text-slate-500">الجرعة</dt>
                                  <dd className="mt-0.5 font-semibold text-slate-800">{rx.dosage}</dd>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2">
                                  <dt className="text-xs font-medium text-slate-500">التكرار</dt>
                                  <dd className="mt-0.5 font-semibold text-slate-800">{rx.frequency}</dd>
                                </div>
                                <div className="rounded-lg bg-slate-50 px-3 py-2">
                                  <dt className="text-xs font-medium text-slate-500">المدة</dt>
                                  <dd className="mt-0.5 font-semibold text-slate-800">{rx.duration}</dd>
                                </div>
                              </dl>
                              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                                {formatDateTime(rx.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col justify-center border-t border-slate-100 pt-3 sm:border-t-0 sm:border-s sm:border-slate-100 sm:ps-4 sm:pt-0">
                            <Button
                              type="button"
                              disabled={b}
                              className="min-h-11 w-full touch-manipulation shadow-sm sm:min-h-0 sm:min-w-[8.5rem] sm:w-auto"
                              onClick={() => void markDispensed(rx.id)}
                            >
                              {b ? '…' : 'تم الصرف'}
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
