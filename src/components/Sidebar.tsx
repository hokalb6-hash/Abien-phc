import {
  Activity,
  FlaskConical,
  LayoutDashboard,
  Monitor,
  Pill,
  Stethoscope,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { BrandMark } from './BrandMark'
import { useAuthStore } from '../store/authStore'
import type { AppRole } from '../types/db'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] }

const items: NavItem[] = [
  { to: '/admin', label: 'الإدارة', icon: LayoutDashboard, roles: ['admin'] },
  { to: '/clinic', label: 'العيادات', icon: Stethoscope, roles: ['clinic', 'admin'] },
  { to: '/lab', label: 'المخبر', icon: FlaskConical, roles: ['lab', 'admin'] },
  { to: '/er', label: 'الإسعاف', icon: Activity, roles: ['er', 'admin'] },
  { to: '/pharmacy', label: 'الصيدلية', icon: Pill, roles: ['pharmacy', 'admin'] },
  { to: '/display', label: 'شاشة الدور', icon: Monitor, roles: ['display', 'admin'] },
]

function linkClass(active: boolean) {
  return `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
    active ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const role = useAuthStore((s) => s.role)
  const visible = items.filter((i) => role && i.roles.includes(role))

  return (
    <aside className="h-full w-60 shrink-0 border-e border-slate-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-3">
        <BrandMark size={34} className="rounded-lg" />
        <span className="truncate text-lg font-bold text-teal-700">أبين الصحي</span>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {visible.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => linkClass(isActive)}
            end={to === '/admin'}
            onClick={() => onNavigate?.()}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
