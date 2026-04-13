import { LogOut, Menu } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { SITE_DEVELOPER_CREDIT_AR } from '../constants/brand'
import { BrandMark } from './BrandMark'
import { Sidebar } from './Sidebar'
import { Button } from './ui/Button'

export function Layout() {
  const { profile, signOut, loading } = useAuthStore()
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUiStore()

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
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* على الشاشات الصغيرة: قائمة منزلقة فوق المحتوى وليس عموداً يضيق الصفحة */}
      <div
        className={`fixed inset-y-0 right-0 z-50 h-full w-60 max-w-[min(100vw,16rem)] transition-transform duration-200 ease-out md:static md:z-auto md:max-w-none md:translate-x-0 md:shadow-none ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : 'translate-x-full pointer-events-none md:pointer-events-auto'
        } md:translate-x-0`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
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
        <main className="min-w-0 flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-2.5 text-center text-[11px] text-slate-500">
          {SITE_DEVELOPER_CREDIT_AR}
        </footer>
      </div>
    </div>
  )
}
