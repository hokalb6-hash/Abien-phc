import { LogOut, Menu } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { BrandMark } from './BrandMark'
import { Sidebar } from './Sidebar'
import { Button } from './ui/Button'

export function Layout() {
  const { profile, signOut, loading } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUiStore()

  async function handleSignOut() {
    try {
      await signOut()
      toast.success('تم تسجيل الخروج')
    } catch {
      toast.error('تعذر تسجيل الخروج')
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className={sidebarOpen ? 'block' : 'hidden md:block'}>
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link to="/" className="shrink-0" title="أبين الصحي — الصفحة الرئيسية">
              <BrandMark size={30} className="rounded-lg" />
            </Link>
            <Button
              type="button"
              variant="ghost"
              className="md:hidden"
              onClick={toggleSidebar}
              aria-label="القائمة"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="truncate text-sm text-slate-600">
              {profile?.full_name ?? 'مستخدم'} —{' '}
              <span className="font-medium text-slate-900">{profile?.role ?? '—'}</span>
            </span>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleSignOut()}
            disabled={loading}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            خروج
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
