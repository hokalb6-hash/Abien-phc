import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { UserPlus } from 'lucide-react'
import { createEphemeralSupabaseClient } from '../../lib/supabaseEphemeral'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import type { AppRole, Profile } from '../../types/db'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Table, TBody, Td, Th, THead, Tr } from '../../components/ui/Table'

const STAFF_ROLES: { value: AppRole; label: string }[] = [
  { value: 'clinic', label: 'عيادات (طبيب / كادر)' },
  { value: 'lab', label: 'مخبر' },
  { value: 'er', label: 'إسعاف' },
  { value: 'pharmacy', label: 'صيدلية' },
  { value: 'display', label: 'شاشة الدور' },
  { value: 'reception', label: 'استقبال (قديم)' },
  { value: 'admin', label: 'مدير (احذر)' },
]

interface Props {
  onStaffChanged?: () => void
}

export function AdminStaffSection({ onStaffChanged }: Props) {
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'clinic' as AppRole,
  })
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [roleDraft, setRoleDraft] = useState<Record<string, AppRole>>({})

  const loadProfiles = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error(error.message)
      setProfiles([])
    } else {
      setProfiles((data ?? []) as Profile[])
      const draft: Record<string, AppRole> = {}
      for (const p of data ?? []) {
        draft[p.id] = p.role as AppRole
      }
      setRoleDraft(draft)
    }
    setLoadingList(false)
  }, [])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  async function handleCreateStaff(e: FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim() || form.password.length < 6) {
      toast.error('أدخل الاسم والبريد وكلمة مرور لا تقل عن 6 أحرف')
      return
    }

    setCreating(true)
    try {
      const ephemeral = createEphemeralSupabaseClient()
      const { data, error } = await ephemeral.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: { full_name: form.full_name.trim() },
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      if (!data.user?.id) {
        toast.error('لم يُرجع النظام معرف المستخدم. تحقق من إعدادات تأكيد البريد.')
        return
      }

      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          role: form.role,
        })
        .eq('id', data.user.id)

      if (upErr) {
        toast.error(`أُنشئ الحساب لكن فشل ضبط الدور: ${upErr.message}`)
        return
      }

      toast.success('تم إنشاء حساب الموظف. يمكنه تسجيل الدخول بالبريد وكلمة المرور.')
      setForm({ full_name: '', email: '', password: '', role: 'clinic' })
      await loadProfiles()
      onStaffChanged?.()
    } finally {
      setCreating(false)
    }
  }

  async function saveRole(profileId: string) {
    const next = roleDraft[profileId]
    if (!next) return
    setSavingId(profileId)
    try {
      const { error } = await supabase.from('profiles').update({ role: next }).eq('id', profileId)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('تم تحديث الدور')
      await loadProfiles()
      onStaffChanged?.()
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <Card title="إضافة موظف جديد">
        <form onSubmit={(e) => void handleCreateStaff(e)} className="grid max-w-xl gap-4">
          <Input
            label="الاسم الظاهر في النظام"
            name="full_name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            required
          />
          <Input
            label="البريد الإلكتروني (اسم المستخدم)"
            name="email"
            type="email"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            dir="ltr"
            required
          />
          <Input
            label="كلمة المرور الأولية"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            dir="ltr"
            minLength={6}
            required
          />
          <Select
            label="الدور في النظام"
            name="role"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={creating} className="w-full min-h-11 touch-manipulation gap-2 sm:w-fit sm:min-h-0">
            <UserPlus className="h-4 w-4" />
            {creating ? 'جاري الإنشاء…' : 'إنشاء حساب الموظف'}
          </Button>
        </form>
      </Card>

      <Card title="الموظفون والأدوار">
        {loadingList ? (
          <p className="text-slate-500">جاري التحميل…</p>
        ) : profiles.length === 0 ? (
          <p className="text-slate-500">لا توجد ملفات مستخدمين بعد.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>الاسم</Th>
                <Th>المعرّف</Th>
                <Th>الدور الحالي</Th>
                <Th>تعديل</Th>
              </Tr>
            </THead>
            <TBody>
              {profiles.map((p) => {
                const draft = roleDraft[p.id] ?? (p.role as AppRole)
                const changed = draft !== p.role
                const isSelf = currentUserId === p.id
                return (
                  <Tr key={p.id}>
                    <Td>{p.full_name ?? '—'}</Td>
                    <Td className="font-mono text-xs">
                      <span dir="ltr">{p.id.slice(0, 8)}…</span>
                    </Td>
                    <Td>
                      <Select
                        aria-label={`دور ${p.full_name ?? p.id}`}
                        value={draft}
                        disabled={isSelf}
                        onChange={(e) =>
                          setRoleDraft((d) => ({ ...d, [p.id]: e.target.value as AppRole }))
                        }
                        className="max-w-[220px] py-1.5 text-sm"
                      >
                        {STAFF_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                      {isSelf ? (
                        <p className="mt-1 text-xs text-amber-700">لا يمكن تغيير دورك وأنت مسجّل.</p>
                      ) : null}
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!changed || savingId === p.id}
                        onClick={() => void saveRole(p.id)}
                        className="text-sm"
                      >
                        {savingId === p.id ? '…' : 'حفظ الدور'}
                      </Button>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
