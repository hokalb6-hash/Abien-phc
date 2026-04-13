import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { AppRole } from '../types/db'

interface ProtectedRouteProps {
  children: ReactNode
  /** إن وُجدت: يُسمح فقط لهذه الأدوار */
  roles?: AppRole[]
}

/**
 * حماية المسار: يتطلب جلسة نشطة، واختيارياً دوراً محدداً من Zustand.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation()
  const { user, role, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-600">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent"
          aria-hidden
        />
        <p className="text-sm">جاري التحميل…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles?.length && role && !roles.includes(role)) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">غير مصرح</h1>
        <p className="mt-2 text-slate-600">ليس لديك صلاحية الوصول إلى هذه الصفحة.</p>
      </div>
    )
  }

  if (roles?.length && !role) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold text-slate-900">لم يُحدد الدور</h1>
        <p className="mt-2 text-slate-600">
          لا يوجد دور مرتبط بحسابك في جدول الملفات الشخصية. تواصل مع المسؤول.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
