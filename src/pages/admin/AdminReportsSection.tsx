import { useCallback, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { BarChart3, Download, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatDateTime, queueStatusLabel } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'

type ReportKind = 'queues' | 'referrals' | 'patients' | 'clinic_stats' | 'diagnosis_stats'

function addDaysToYMD(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10))
  const next = new Date(Date.UTC(y, m - 1, d + delta))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

function referralStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'معلق',
    in_progress: 'قيد التنفيذ',
    completed: 'مكتمل',
  }
  return map[status] ?? status
}

function adenDayBoundsISO(fromYmd: string, toYmd: string): { start: string; end: string } {
  return {
    start: `${fromYmd}T00:00:00+03:00`,
    end: `${toYmd}T23:59:59.999+03:00`,
  }
}

type FlatRow = Record<string, string | number | null>

type ReportAggregates =
  | { kind: 'queues'; counts: Record<string, number> }
  | { kind: 'referrals'; counts: Record<string, number> }
  | { kind: 'patients'; counts: Record<string, number> }
  | { kind: 'clinic_stats'; counts: Record<string, number> }
  | { kind: 'diagnosis_stats'; counts: Record<string, number> }

export function AdminReportsSection() {
  const today = todayAdenYMD()
  const [dateFrom, setDateFrom] = useState(() => addDaysToYMD(today, -30))
  const [dateTo, setDateTo] = useState(today)
  const [kind, setKind] = useState<ReportKind>('queues')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<FlatRow[]>([])
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: '',
    dir: 'asc',
  })

  const load = useCallback(async () => {
    if (dateFrom > dateTo) {
      toast.error('تاريخ البداية يجب أن يكون قبل أو يساوي نهاية الفترة')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (kind === 'queues') {
        const { data, error: qErr } = await supabase
          .from('queues')
          .select(
            'id, queue_number, service_date, clinic_type, status, created_at, patients (full_name, phone, national_id)',
          )
          .gte('service_date', dateFrom)
          .lte('service_date', dateTo)
          .order('service_date', { ascending: false })
          .order('queue_number', { ascending: true })
          .limit(2000)

        if (qErr) throw qErr
        const flat: FlatRow[] = (data ?? []).map((r) => {
          const p = r.patients as { full_name?: string; phone?: string | null; national_id?: string | null } | null
          return {
            رقم_الدور: r.queue_number,
            تاريخ_الخدمة: r.service_date,
            نوع_العيادة: clinicTypeLabel(r.clinic_type),
            الحالة: queueStatusLabel(r.status),
            اسم_المريض: p?.full_name ?? '—',
            الهاتف: p?.phone ?? '—',
            الرقم_الوطني: p?.national_id ?? '—',
            تسجيل_النظام: formatDateTime(r.created_at),
          }
        })
        setRows(flat)
        return
      }

      if (kind === 'referrals') {
        const { start, end } = adenDayBoundsISO(dateFrom, dateTo)
        const { data, error: refErr } = await supabase
          .from('referrals')
          .select(
            'id, department, from_department, status, notes, created_at, queues (queue_number, clinic_type, service_date, status, patients (full_name, phone, national_id))',
          )
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: false })
          .limit(2000)

        if (refErr) throw refErr
        const flat: FlatRow[] = (data ?? []).map((r) => {
          const q = r.queues as {
            queue_number?: number
            clinic_type?: string
            service_date?: string
            status?: string
            patients?: { full_name?: string; phone?: string | null; national_id?: string | null } | null
          } | null
          const p = q?.patients
          return {
            القسم: r.department,
            من_قسم: r.from_department ?? '—',
            حالة_التحويل: referralStatusLabel(r.status),
            رقم_دور_العيادة: q?.queue_number ?? '—',
            نوع_العيادة: q?.clinic_type ? clinicTypeLabel(q.clinic_type) : '—',
            تاريخ_خدمة_الدور: q?.service_date ?? '—',
            حالة_الدور: q?.status ? queueStatusLabel(q.status) : '—',
            اسم_المريض: p?.full_name ?? '—',
            الهاتف: p?.phone ?? '—',
            ملاحظات: r.notes ?? '—',
            تاريخ_التسجيل: formatDateTime(r.created_at),
          }
        })
        setRows(flat)
        return
      }

      if (kind === 'clinic_stats') {
        const { data, error: cErr } = await supabase
          .from('queues')
          .select('clinic_type, status')
          .gte('service_date', dateFrom)
          .lte('service_date', dateTo)
          .limit(15000)

        if (cErr) throw cErr
        const bucket = new Map<string, number>()
        for (const r of data ?? []) {
          const ct = clinicTypeLabel(String((r as { clinic_type?: string }).clinic_type ?? ''))
          const st = queueStatusLabel(String((r as { status?: string }).status ?? ''))
          const key = `${ct}\t${st}`
          bucket.set(key, (bucket.get(key) ?? 0) + 1)
        }
        const flat: FlatRow[] = [...bucket.entries()]
          .map(([key, n]) => {
            const [نوع_العيادة, حالة_الدور] = key.split('\t')
            return { نوع_العيادة, حالة_الدور, العدد: n }
          })
          .sort((a, b) => Number(b['العدد']) - Number(a['العدد']))
        setRows(flat)
        return
      }

      if (kind === 'diagnosis_stats') {
        const { data: queueRows, error: qIdErr } = await supabase
          .from('queues')
          .select('id')
          .gte('service_date', dateFrom)
          .lte('service_date', dateTo)
          .limit(12000)

        if (qIdErr) throw qIdErr
        const queueIds = [...new Set((queueRows ?? []).map((r: { id: string }) => r.id))]
        if (queueIds.length === 0) {
          setRows([])
          return
        }

        type QdRow = {
          diagnosis_id: string
          created_at: string
          diagnoses: { name_ar?: string; code?: string | null } | null
        }

        const allQd: QdRow[] = []
        const chunkSize = 120
        for (let i = 0; i < queueIds.length; i += chunkSize) {
          const chunk = queueIds.slice(i, i + chunkSize)
          const { data: qdBatch, error: dErr } = await supabase
            .from('queue_diagnoses')
            .select('diagnosis_id, created_at, diagnoses (name_ar, code)')
            .in('queue_id', chunk)
          if (dErr) throw dErr
          allQd.push(...((qdBatch ?? []) as QdRow[]))
        }

        const bucket = new Map<string, { name: string; code: string; n: number }>()
        for (const row of allQd) {
          const d = row.diagnoses as { name_ar?: string; code?: string | null } | null
          const name = (d?.name_ar ?? '—').trim() || '—'
          const code = (d?.code ?? '—').trim() || '—'
          const key = `${name}\t${code}`
          const prev = bucket.get(key) ?? { name, code, n: 0 }
          prev.n += 1
          bucket.set(key, prev)
        }
        const flat: FlatRow[] = [...bucket.values()]
          .map(({ name, code, n }) => ({
            اسم_التشخيص: name,
            الكود: code,
            العدد: n,
          }))
          .sort((a, b) => Number(b['العدد']) - Number(a['العدد']))
        setRows(flat)
        return
      }

      const { start, end } = adenDayBoundsISO(dateFrom, dateTo)
      const { data, error: pErr } = await supabase
        .from('patients')
        .select('id, full_name, phone, national_id, gender, date_of_birth, created_at')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .limit(2000)

      if (pErr) throw pErr
      const flat: FlatRow[] = (data ?? []).map((r) => ({
        الاسم: r.full_name,
        الهاتف: r.phone ?? '—',
        الرقم_الوطني: r.national_id ?? '—',
        الجنس: r.gender ?? '—',
        تاريخ_الميلاد: r.date_of_birth ?? '—',
        تاريخ_التسجيل: formatDateTime(r.created_at),
      }))
      setRows(flat)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذر تحميل التقرير'
      setError(msg)
      setRows([])
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, kind])

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (q) {
      list = rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q)),
      )
    }
    if (!sort.key) return list
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = sort.key
    return [...list].sort((a, b) => {
      const va = a[key]
      const vb = b[key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'ar') * dir
    })
  }, [rows, search, sort])

  const aggregates = useMemo((): ReportAggregates => {
    if (kind === 'queues') {
      const counts: Record<string, number> = {}
      for (const r of filteredSorted) {
        const label = String(r['نوع_العيادة'] ?? '')
        counts[label] = (counts[label] ?? 0) + 1
      }
      return { kind: 'queues', counts }
    }
    if (kind === 'referrals') {
      const counts: Record<string, number> = {}
      for (const r of filteredSorted) {
        const label = String(r['القسم'] ?? '')
        counts[label] = (counts[label] ?? 0) + 1
      }
      return { kind: 'referrals', counts }
    }
    if (kind === 'clinic_stats') {
      const counts: Record<string, number> = {}
      for (const r of filteredSorted) {
        const label = String(r['نوع_العيادة'] ?? '')
        counts[label] = (counts[label] ?? 0) + Number(r['العدد'] ?? 0)
      }
      return { kind: 'clinic_stats', counts }
    }
    if (kind === 'diagnosis_stats') {
      const counts: Record<string, number> = {}
      for (const r of filteredSorted) {
        const label = String(r['اسم_التشخيص'] ?? '')
        counts[label] = (counts[label] ?? 0) + Number(r['العدد'] ?? 0)
      }
      return { kind: 'diagnosis_stats', counts }
    }
    const counts: Record<string, number> = {}
    for (const r of filteredSorted) {
      const label = String(r['الجنس'] ?? '—')
      counts[label] = (counts[label] ?? 0) + 1
    }
    return { kind: 'patients', counts }
  }, [filteredSorted, kind])

  const maxBar = useMemo(() => {
    const vals = Object.values(aggregates.counts)
    return Math.max(1, ...vals)
  }, [aggregates])

  function toggleSort(key: string) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    )
  }

  async function exportExcel() {
    if (filteredSorted.length === 0) {
      toast.error('لا توجد بيانات للتصدير')
      return
    }
    try {
      const XLSX = await import('xlsx')
      const arabicHeaders = filteredSorted.map((row) => {
        const o: Record<string, string | number | null> = {}
        for (const [k, v] of Object.entries(row)) {
          o[k.replaceAll('_', ' ')] = v
        }
        return o
      })
      const labels: Record<ReportKind, string> = {
        queues: 'دور العيادات',
        referrals: 'التحويلات',
        patients: 'المرضى المسجّلون',
        clinic_stats: 'إحصائيات العيادات',
        diagnosis_stats: 'إحصائيات التشخيصات',
      }
      const sheet = labels[kind].slice(0, 31)
      const ws = XLSX.utils.json_to_sheet(arabicHeaders)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheet)
      const fname = `تقرير-${labels[kind]}-${dateFrom}-${dateTo}.xlsx`
      XLSX.writeFile(wb, fname)
      toast.success('تم تصدير الملف')
    } catch {
      toast.error('تعذر تحميل مكتبة التصدير')
    }
  }

  const columns = filteredSorted[0] ? Object.keys(filteredSorted[0]) : []

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-2">
          <BarChart3 className="mt-1 h-8 w-8 shrink-0 text-teal-600" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-slate-800">التقارير التفاعلية</h2>
            <p className="max-w-2xl text-sm text-slate-600">
              اختر نوع التقرير والفترة، ثم صفِّ النتائج بالنقر على رؤوس الأعمدة، وابحث نصياً، وصدِّر إلى Excel عند
              الحاجة (حتى 2000 صف لكل استعلام).
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <Select
          label="نوع التقرير"
          value={kind}
          onChange={(e) => setKind(e.target.value as ReportKind)}
          className="min-w-[200px] sm:max-w-xs"
        >
          <option value="queues">دور العيادات (حسب تاريخ الخدمة)</option>
          <option value="clinic_stats">إحصائيات العيادات — أعداد حسب النوع والحالة (تاريخ الخدمة)</option>
          <option value="referrals">التحويلات (حسب تاريخ التسجيل)</option>
          <option value="patients">المرضى الجدد (حسب تاريخ التسجيل)</option>
          <option value="diagnosis_stats">إحصائيات التشخيصات — تكرار التشخيص المربوط بالدور (تاريخ خدمة الدور)</option>
        </Select>
        <Input
          label="من تاريخ"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="sm:max-w-[200px]"
        />
        <Input
          label="إلى تاريخ"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="sm:max-w-[200px]"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            تحديث
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={loading || filteredSorted.length === 0}
            onClick={() => void exportExcel()}
          >
            <Download className="h-4 w-4" aria-hidden />
            تصدير Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label="بحث في النتائج"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اكتب للتصفية في الأعمدة…"
          />
        </div>
        <p className="text-sm text-slate-500 sm:pb-2">
          {filteredSorted.length} / {rows.length} صف
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {Object.keys(aggregates.counts).length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">
            {aggregates.kind === 'queues'
              ? 'توزيع حسب نوع العيادة (للصفوف المعروضة)'
              : aggregates.kind === 'referrals'
                ? 'توزيع حسب القسم (للصفوف المعروضة)'
                : aggregates.kind === 'clinic_stats'
                  ? 'إجمالي أدوار كل عيادة ضمن الصفوف المعروضة (مجموع العدد)'
                  : aggregates.kind === 'diagnosis_stats'
                    ? 'إجمالي تسجيلات كل تشخيص ضمن الصفوف المعروضة (مجموع العدد)'
                    : 'توزيع حسب الجنس (للصفوف المعروضة)'}
          </p>
          <div className="space-y-2">
            {Object.entries(aggregates.counts)
              .sort((a, b) => b[1] - a[1])
              .map(([label, n]) => (
                <div key={label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <span className="shrink-0 text-xs text-slate-600 sm:w-40 sm:text-sm">{label}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-[width]"
                        style={{ width: `${(n / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 tabular-nums text-sm font-semibold text-slate-800">{n}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {columns.length === 0 && !loading ? (
        <p className="text-center text-sm text-slate-500">اضغط «تحديث» لتحميل البيانات.</p>
      ) : (
        <Table className="text-xs sm:text-sm">
          <THead>
            <Tr>
              {columns.map((col) => (
                <Th
                  key={col}
                  className="cursor-pointer select-none whitespace-nowrap hover:bg-slate-100"
                  onClick={() => toggleSort(col)}
                  title="ترتيب"
                >
                  {col.replaceAll('_', ' ')}
                  {sort.key === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {loading ? (
              <Tr>
                <Td className="py-8 text-center text-slate-500" colSpan={Math.max(1, columns.length)}>
                  جاري التحميل…
                </Td>
              </Tr>
            ) : (
              filteredSorted.map((row, i) => (
                <Tr key={i}>
                  {columns.map((col) => (
                    <Td key={col} className="max-w-[220px] truncate sm:max-w-none">
                      {row[col] ?? '—'}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      )}
    </section>
  )
}
