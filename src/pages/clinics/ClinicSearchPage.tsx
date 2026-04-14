import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { CLINIC_TYPES } from '../../constants/clinics'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'
import { supabase } from '../../lib/supabase'
import type { Queue } from '../../types/db'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { clinicTypeLabel, formatDateTime, queueStatusLabel } from '../../utils/format'

type SearchRow = Pick<Queue, 'id' | 'queue_number' | 'clinic_type' | 'status' | 'service_date' | 'created_at'> & {
  patients: { full_name: string | null; phone: string | null; national_id: string | null } | null
}

function sanitizePatientNameForIlike(s: string) {
  return s.replace(/\\/g, '').replace(/%/g, '').replace(/_/g, '')
}

export default function ClinicSearchPage() {
  const [rows, setRows] = useState<SearchRow[]>([])
  const [loading, setLoading] = useState(false)
  const [patientName, setPatientName] = useState('')
  const [fromDate, setFromDate] = useState(() => todayAdenYMD())
  const [toDate, setToDate] = useState(() => todayAdenYMD())
  const [submittedName, setSubmittedName] = useState('')

  const normalizedRange = useMemo(() => {
    const today = todayAdenYMD()
    let from = fromDate.trim() || today
    let to = toDate.trim() || today
    if (from > to) {
      const tmp = from
      from = to
      to = tmp
    }
    return { from, to }
  }, [fromDate, toDate])

  const runSearch = useCallback(async () => {
    const safeName = sanitizePatientNameForIlike(submittedName.trim())
    if (!safeName) {
      setRows([])
      return
    }

    setLoading(true)
    try {
      let q = supabase
        .from('queues')
        .select(
          'id, queue_number, clinic_type, status, service_date, created_at, patients!inner (full_name, phone, national_id)',
        )
        .in('clinic_type', [...CLINIC_TYPES])
        .gte('service_date', normalizedRange.from)
        .lte('service_date', normalizedRange.to)
        .ilike('patients.full_name', `%${safeName}%`)
        .order('service_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)

      const { data, error } = await q
      if (error) {
        toast.error(error.message)
        setRows([])
        return
      }
      setRows((data ?? []) as SearchRow[])
    } finally {
      setLoading(false)
    }
  }, [submittedName, normalizedRange.from, normalizedRange.to])

  useEffect(() => {
    void runSearch()
  }, [runSearch])

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <Search className="h-7 w-7 text-teal-600 sm:h-8 sm:w-8" />
          البحث في المراجعين
        </h1>
        <p className="mt-1 text-slate-600">ابحث باسم المريض مع تحديد الفترة الزمنية (من - إلى).</p>
      </header>

      <Card title="معايير البحث">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              label="اسم المريض"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="أدخل الاسم أو جزءاً منه"
              autoComplete="off"
            />
          </div>
          <Input label="من تاريخ" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="إلى تاريخ" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-10"
            onClick={() => {
              const name = patientName.trim()
              if (!name) {
                toast.error('أدخل اسم المريض أولاً')
                return
              }
              setSubmittedName(name)
            }}
          >
            تنفيذ البحث
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-10"
            onClick={() => {
              const t = todayAdenYMD()
              setPatientName('')
              setSubmittedName('')
              setFromDate(t)
              setToDate(t)
              setRows([])
            }}
          >
            تصفير الحقول
          </Button>
        </div>
      </Card>

      <Card title="نتائج البحث">
        {!submittedName.trim() ? (
          <p className="text-slate-500">اكتب اسم المريض ثم اضغط «تنفيذ البحث».</p>
        ) : loading ? (
          <p className="text-slate-500">جاري البحث…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">لا توجد نتائج مطابقة.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الرقم</Th>
                <Th>الاسم</Th>
                <Th>العيادة</Th>
                <Th>تاريخ الخدمة</Th>
                <Th>الحالة</Th>
                <Th>وقت الإنشاء</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-bold text-teal-800">{r.queue_number}</Td>
                  <Td>{r.patients?.full_name ?? '—'}</Td>
                  <Td>{clinicTypeLabel(r.clinic_type)}</Td>
                  <Td>{r.service_date}</Td>
                  <Td>
                    <Badge>{queueStatusLabel(r.status)}</Badge>
                  </Td>
                  <Td>{formatDateTime(r.created_at)}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
