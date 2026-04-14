import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Stethoscope, UserPlus } from 'lucide-react'
import { CLINIC_LABELS, CLINIC_TYPES, type ClinicTypeValue } from '../../constants/clinics'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { supabase } from '../../lib/supabase'

export default function ClinicWalkInPage() {
  const navigate = useNavigate()
  const [walkIn, setWalkIn] = useState({
    full_name: '',
    phone: '',
    national_id: '',
    date_of_birth: '',
    gender: '',
    clinic_type: '' as ClinicTypeValue | '',
  })
  const [saving, setSaving] = useState(false)

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
    setSaving(true)
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
      navigate('/clinic')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <header className="border-b border-slate-200 pb-4">
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
          <Stethoscope className="h-7 w-7 text-teal-600 sm:h-8 sm:w-8" />
          تسجيل مراجع بدون حجز مسبق
        </h1>
        <p className="mt-1 text-slate-600">تسجيل عند الحضور وإصدار رقم دور اليوم للعيادة المختارة.</p>
      </header>

      <Card title="بيانات التسجيل">
        <form onSubmit={(ev) => void registerWalkInAtClinic(ev)} className="grid gap-3">
          <Select
            label="العيادة المطلوبة"
            value={walkIn.clinic_type}
            onChange={(e) => setWalkIn((w) => ({ ...w, clinic_type: e.target.value as ClinicTypeValue | '' }))}
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
          <Select label="الجنس" value={walkIn.gender} onChange={(e) => setWalkIn((w) => ({ ...w, gender: e.target.value }))}>
            <option value="">— غير محدد —</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </Select>

          <div className="mt-1 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap">
            <Button type="submit" disabled={saving} className="min-h-11 w-full touch-manipulation gap-2 sm:w-auto">
              <UserPlus className="h-4 w-4" />
              {saving ? 'جاري التسجيل…' : 'تسجيل المراجع وإصدار رقم الدور'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={() => navigate('/clinic')}
            >
              رجوع إلى العيادات
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
