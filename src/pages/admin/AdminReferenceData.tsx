import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { BookMarked, ClipboardList, Pill } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { AuditLog, Diagnosis, Medication } from '../../types/db'
import { formatDateTime } from '../../utils/format'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'

type Tab = 'diagnoses' | 'medications' | 'audit'

export function AdminReferenceData() {
  const [tab, setTab] = useState<Tab>('diagnoses')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <TabBtn active={tab === 'diagnoses'} onClick={() => setTab('diagnoses')} icon={BookMarked} label="التشخيصات" />
        <TabBtn active={tab === 'medications'} onClick={() => setTab('medications')} icon={Pill} label="الأدوية" />
        <TabBtn
          active={tab === 'audit'}
          onClick={() => setTab('audit')}
          icon={ClipboardList}
          label="سجل التدقيق"
        />
      </div>
      {tab === 'diagnoses' ? <DiagnosesManager /> : null}
      {tab === 'medications' ? <MedicationsManager /> : null}
      {tab === 'audit' ? <AuditLogTable /> : null}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof BookMarked
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function DiagnosesManager() {
  const [rows, setRows] = useState<Diagnosis[]>([])
  const [nameAr, setNameAr] = useState('')
  const [code, setCode] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('diagnoses').select('*').order('name_ar')
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((data ?? []) as Diagnosis[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!nameAr.trim()) {
      toast.error('اسم التشخيص بالعربية مطلوب')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('diagnoses').insert({
      name_ar: nameAr.trim(),
      code: code.trim() || null,
      description: desc.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('أُضيف التشخيص')
    setNameAr('')
    setCode('')
    setDesc('')
    void load()
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا التشخيص؟')) return
    const { error } = await supabase.from('diagnoses').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('تم الحذف')
    void load()
  }

  return (
    <div className="space-y-6">
      <Card title="إضافة تشخيص">
        <form onSubmit={(e) => void add(e)} className="grid max-w-xl gap-3">
          <Input label="الاسم بالعربية" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required />
          <Input label="رمز (اختياري)" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" />
          <Input label="وصف (اختياري)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button type="submit" disabled={saving}>
            {saving ? '…' : 'إضافة'}
          </Button>
        </form>
      </Card>
      <Card title="قائمة التشخيصات">
        {rows.length === 0 ? (
          <p className="text-slate-500">لا توجد تشخيصات. أضف من النموذج أعلاه ليستخدمها الأطباء في العيادات.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الاسم</Th>
                <Th>الرمز</Th>
                <Th>حذف</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.name_ar}</Td>
                  <Td>
                    <span dir="ltr">{r.code ?? '—'}</span>
                  </Td>
                  <Td>
                    <Button type="button" variant="danger" className="text-sm" onClick={() => void remove(r.id)}>
                      حذف
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function MedicationsManager() {
  const [rows, setRows] = useState<Medication[]>([])
  const [form, setForm] = useState({ name: '', form: '', unit: '', default_dosage: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('medications').select('*').order('name')
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((data ?? []) as Medication[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('اسم الدواء مطلوب')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('medications').insert({
      name: form.name.trim(),
      form: form.form.trim() || null,
      unit: form.unit.trim() || null,
      default_dosage: form.default_dosage.trim() || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('أُضيف الدواء')
    setForm({ name: '', form: '', unit: '', default_dosage: '' })
    void load()
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا الدواء؟ قد تفشل إن وُجدت وصفات مرتبطة.')) return
    const { error } = await supabase.from('medications').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('تم الحذف')
    void load()
  }

  return (
    <div className="space-y-6">
      <Card title="إضافة دواء">
        <form onSubmit={(e) => void add(e)} className="grid max-w-xl gap-3">
          <Input label="الاسم" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label="الشكل (شراب، أقراص…)" value={form.form} onChange={(e) => setForm((f) => ({ ...f, form: e.target.value }))} />
          <Input label="الوحدة" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
          <Input
            label="جرعة افتراضية (اختياري)"
            value={form.default_dosage}
            onChange={(e) => setForm((f) => ({ ...f, default_dosage: e.target.value }))}
          />
          <Button type="submit" disabled={saving}>
            {saving ? '…' : 'إضافة'}
          </Button>
        </form>
      </Card>
      <Card title="قائمة الأدوية">
        {rows.length === 0 ? (
          <p className="text-slate-500">لا أدوية مسجّلة بعد.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الاسم</Th>
                <Th>الشكل</Th>
                <Th>حذف</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.name}</Td>
                  <Td>{r.form ?? '—'}</Td>
                  <Td>
                    <Button type="button" variant="danger" className="text-sm" onClick={() => void remove(r.id)}>
                      حذف
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function AuditLogTable() {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      setLoading(false)
      if (error) {
        toast.error(error.message)
        return
      }
      setRows((data ?? []) as AuditLog[])
    })()
  }, [])

  return (
    <Card title="آخر 100 سجل (قراءة فقط)">
      <p className="mb-4 text-sm text-slate-600">
        يُفضّل ملء الجدول عبر تريغرات في قاعدة البيانات لاحقاً. إن كان فارغاً فلا توجد أحداث مسجّلة بعد.
      </p>
      {loading ? (
        <p className="text-slate-500">جاري التحميل…</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">لا سجلات.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>الوقت</Th>
              <Th>الإجراء</Th>
              <Th>الجدول</Th>
              <Th>تفاصيل</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="whitespace-nowrap text-sm">{formatDateTime(r.created_at)}</Td>
                <Td>{r.action}</Td>
                <Td>{r.table_name ?? '—'}</Td>
                <Td className="max-w-xs truncate font-mono text-xs" title={JSON.stringify(r.payload)}>
                  {r.payload ? JSON.stringify(r.payload).slice(0, 80) : '—'}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  )
}
