import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { Megaphone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { PatientAnnouncement } from '../../types/db'
import { formatDateTime } from '../../utils/format'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'

export function AdminAnnouncementsSection() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [publishNow, setPublishNow] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<PatientAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('patient_announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    setLoading(false)
    if (error) {
      if (error.message.includes('patient_announcements') || error.code === '42P01') {
        toast.error('جدول الإعلانات غير موجود. نفّذ supabase/patch_patient_announcements.sql')
      } else {
        toast.error(error.message)
      }
      setRows([])
      return
    }
    setRows((data ?? []) as PatientAnnouncement[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ch = supabase
      .channel('admin-patient-announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_announcements' }, () => {
        void load()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const body = message.trim()
    if (!body) {
      toast.error('أدخل نص الإعلان')
      return
    }
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const uid = userData.user?.id ?? null
      const { error } = await supabase.from('patient_announcements').insert({
        title: title.trim() || null,
        message: body,
        is_active: publishNow,
        created_by: uid,
        updated_at: new Date().toISOString(),
      })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success(publishNow ? 'تم نشر الإعلان للمرضى على الموقع' : 'تم حفظ الإعلان (غير مفعّل)')
      setTitle('')
      setMessage('')
      setPublishNow(true)
      void load()
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('patient_announcements')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم إيقاف الإعلان')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function activate(id: string) {
    setBusyId(id)
    try {
      const { error } = await supabase
        .from('patient_announcements')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم تفعيل الإعلان (أُوقِف السابق تلقائياً)')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: string) {
    if (!confirm('حذف هذا الإعلان نهائياً؟')) return
    setBusyId(id)
    try {
      const { error } = await supabase.from('patient_announcements').delete().eq('id', id)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم الحذف')
      void load()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="min-w-0">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
        <Megaphone className="h-6 w-6 text-teal-600" aria-hidden />
        إشعارات المرضى على الموقع
      </h2>
      <p className="mb-6 max-w-2xl text-sm text-slate-600">
        يظهر الإعلان المفعّل في أعلى الصفحة الرئيسية وصفحة حجز الدور للزوار. إعلان واحد فقط يبقى مفعّلاً؛ عند
        نشر جديد يُلغى تفعيل السابق تلقائياً.
      </p>

      <Card title="إنشاء إعلان جديد">
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="عنوان (اختياري)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تعطيل يوم الأحد" />
          <div className="flex flex-col gap-1">
            <label htmlFor="ann-msg" className="text-sm font-medium text-slate-700">
              نص الإعلان <span className="text-red-600">*</span>
            </label>
            <textarea
              id="ann-msg"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="اكتب ما تريد إبلاغ المرضى به…"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            نشر فوراً للمرضى (يظهر على الموقع العام)
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ الإعلان'}
          </Button>
        </form>
      </Card>

      <Card title="آخر الإعلانات" className="mt-6">
        {loading ? (
          <p className="text-slate-500">جاري التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500">لا توجد إعلانات بعد.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الحالة</Th>
                <Th>العنوان / المقتطف</Th>
                <Th>التاريخ</Th>
                <Th>إجراءات</Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const b = busyId === r.id
                const preview = r.message.length > 80 ? `${r.message.slice(0, 80)}…` : r.message
                return (
                  <Tr key={r.id}>
                    <Td>
                      {r.is_active ? <Badge tone="success">مفعّل</Badge> : <Badge>غير مفعّل</Badge>}
                    </Td>
                    <Td>
                      <span className="font-medium text-slate-900">{r.title ?? '—'}</span>
                      <p className="mt-1 text-sm text-slate-600">{preview}</p>
                    </Td>
                    <Td className="whitespace-nowrap text-sm text-slate-600">{formatDateTime(r.created_at)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {r.is_active ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={b}
                            className="text-xs"
                            onClick={() => void deactivate(r.id)}
                          >
                            إيقاف
                          </Button>
                        ) : (
                          <Button type="button" disabled={b} className="text-xs" onClick={() => void activate(r.id)}>
                            تفعيل
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="danger"
                          disabled={b}
                          className="text-xs"
                          onClick={() => void remove(r.id)}
                        >
                          حذف
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </section>
  )
}
