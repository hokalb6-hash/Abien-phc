import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { defaultPathForRole, useAuthStore } from './store/authStore'
import Login from './pages/auth/Login'
import PatientCheckIn from './pages/check-in/PatientCheckIn'
import QueueDisplay from './pages/queue-display/QueueDisplay'
import ClinicWorkspace from './pages/clinics/ClinicWorkspace'
import LabWorkspace from './pages/lab/LabWorkspace'
import ERWorkspace from './pages/er/ERWorkspace'
import PharmacyWorkspace from './pages/pharmacy/PharmacyWorkspace'
import AdminDashboard from './pages/admin/AdminDashboard'
import { BrandMark } from './components/BrandMark'
import PatientHome from './pages/public/PatientHome'

/** للزائر: صفحة حجز من المنزل؛ للموظف المسجّل: توجيه للوحة الدور */
function RootEntry() {
  const { user, role, loading, initialized } = useAuthStore()

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
        <BrandMark size={52} className="rounded-xl opacity-90 shadow-sm" />
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <PatientHome />
  }

  return <Navigate to={defaultPathForRole(role)} replace />
}

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/check-in" element={<PatientCheckIn />} />
      <Route path="/reception" element={<Navigate to="/check-in" replace />} />
      <Route path="/" element={<RootEntry />} />

      <Route
        path="/display"
        element={
          <ProtectedRoute roles={['display', 'admin']}>
            <QueueDisplay />
          </ProtectedRoute>
        }
      />

      {/* مسارات نسبية تحت تخطيط بلا path حتى يعمل <Outlet /> بشكل موثوق في React Router v6 */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="clinic"
          element={
            <ProtectedRoute roles={['clinic', 'admin']}>
              <ClinicWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="lab"
          element={
            <ProtectedRoute roles={['lab', 'admin']}>
              <LabWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="er"
          element={
            <ProtectedRoute roles={['er', 'admin']}>
              <ERWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="pharmacy"
          element={
            <ProtectedRoute roles={['pharmacy', 'admin']}>
              <PharmacyWorkspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
