import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, FlaskConical, LayoutDashboard, Monitor, Pill, Stethoscope, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { todayAdenYMD } from '../../utils/adenCalendar'
import { Badge } from '../../components/ui/Badge'
import { AdminAnnouncementsSection } from './AdminAnnouncementsSection'
import { AdminStaffSection } from './AdminStaffSection'
import { AdminReferenceData } from './AdminReferenceData'
import { AdminReportsSection } from './AdminReportsSection'

/**
 * لوحة الإدارة — نظرة عامة وروابط سريعة (جداول الإدارة الكاملة تُضاف تدريجياً).
 */
export default function AdminDashboard() {
  const [counts, setCounts] = useState<{
    patients: number | null
    queuesToday: number | null
    users: number | null
  }>({ patients: null, queuesToday: null, users: null })
  const [loadError, setLoadError] = useState<string | null>(null)

  const reloadCounts = useCallback(() => {
    void (async () => {
      setLoadError(null)

      const [patientsRes, queuesRes, profilesRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase
          .from('queues')
          .select('id', { count: 'exact', head: true })
          .eq('service_date', todayAdenYMD()),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ])

      const err =
        patientsRes.error?.message || queuesRes.error?.message || profilesRes.error?.message
      if (err) {
        setLoadError(err)
        return
      }

      setCounts({
        patients: patientsRes.count ?? 0,
        queuesToday: queuesRes.count ?? 0,
        users: profilesRes.count ?? 0,
      })
    })()
  }, [])

  useEffect(() => {
    reloadCounts()
  }, [reloadCounts])

  const statClass =
    'rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md'

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <LayoutDashboard className="h-9 w-9 text-teal-600" aria-hidden />
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">لوحة الإدارة</h1>
          <Badge tone="info">مسؤول النظام</Badge>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          نظرة سريعة على النظام، إضافة موظفي العيادات والأقسام، إدارة التشخيصات والأدوية، وسجل التدقيق، مع روابط
          سريعة للأقسام.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          تعذر تحميل الإحصائيات: {loadError}
        </div>
      ) : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">مؤشرات سريعة</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={statClass}>
            <p className="text-sm font-medium text-slate-500">المرضى (إجمالي السجلات)</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {counts.patients === null ? '…' : counts.patients}
            </p>
          </div>
          <div className={statClass}>
            <p className="text-sm font-medium text-slate-500">طلبات الدور اليوم</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {counts.queuesToday === null ? '…' : counts.queuesToday}
            </p>
          </div>
          <div className={statClass}>
            <p className="text-sm font-medium text-slate-500">مستخدمو النظام (ملفات)</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {counts.users === null ? '…' : counts.users}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">وصول سريع للأقسام</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/clinic" icon={Stethoscope} label="العيادات" />
          <QuickLink to="/lab" icon={FlaskConical} label="المخبر" />
          <QuickLink to="/er" icon={Activity} label="الإسعاف" />
          <QuickLink to="/pharmacy" icon={Pill} label="الصيدلية" />
          <QuickLink to="/display" icon={Monitor} label="شاشة الدور" />
        </div>
      </section>

      <AdminReportsSection />

      <AdminAnnouncementsSection />

      <AdminStaffSection onStaffChanged={reloadCounts} />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">البيانات المرجعية وسجل التدقيق</h2>
        <AdminReferenceData />
        <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
          <Users className="h-4 w-4 shrink-0" aria-hidden />
          حذف المستخدمين يتم من لوحة Supabase → Authentication إن لزم.
        </p>
      </section>
    </div>
  )
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof Stethoscope
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition touch-manipulation hover:border-teal-300 hover:bg-teal-50/50"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-medium text-slate-800">{label}</span>
    </Link>
  )
}
