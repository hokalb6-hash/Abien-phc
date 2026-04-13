import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { SITE_DEVELOPER_CREDIT_AR } from '../../constants/brand'
import { STAFF_ENTRY_CODE, STAFF_GATE_STORAGE_KEY } from '../../constants/staffGate'
import { defaultPathForRole, useAuthStore } from '../../store/authStore'
import { BrandMark } from '../../components/BrandMark'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, user, role, loading, initialized } = useAuthStore()
  const [gatePassed, setGatePassed] = useState(() => {
    try {
      return sessionStorage.getItem(STAFF_GATE_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [gateInput, setGateInput] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialized && !loading && user) {
      navigate(defaultPathForRole(role), { replace: true })
    }
  }, [user, role, loading, initialized, navigate])

  function handleGateSubmit(e: FormEvent) {
    e.preventDefault()
    if (gateInput.trim() !== STAFF_ENTRY_CODE) {
      toast.error('رمز الدخول غير صحيح')
      return
    }
    try {
      sessionStorage.setItem(STAFF_GATE_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    setGatePassed(true)
    setGateInput('')
    toast.success('يمكنك الآن تسجيل الدخول')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error('أدخل البريد وكلمة المرور')
      return
    }
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('تم تسجيل الدخول')
    navigate(defaultPathForRole(useAuthStore.getState().role), { replace: true })
  }

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-100">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <BrandMark size={52} className="rounded-xl opacity-90 shadow-sm" />
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
        </div>
        <p className="shrink-0 py-4 text-center text-xs text-slate-500">{SITE_DEVELOPER_CREDIT_AR}</p>
      </div>
    )
  }

  if (!gatePassed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-b from-teal-50 to-slate-100 p-4">
        <BrandMark size={56} className="rounded-2xl bg-white/80 p-2 shadow-md ring-1 ring-teal-100" />
        <Card title="دخول الموظفين — أبين الصحي" className="w-full max-w-md">
          <p className="mb-4 text-sm text-slate-600">
            أدخل رمز الدخول المخصّص للموظفين للوصول إلى صفحة تسجيل الدخول.
          </p>
          <form onSubmit={handleGateSubmit} className="flex flex-col gap-4">
            <Input
              label="رمز الدخول"
              name="staff_gate"
              type="password"
              autoComplete="off"
              value={gateInput}
              onChange={(e) => setGateInput(e.target.value)}
              dir="ltr"
            />
            <Button type="submit" className="w-full justify-center py-2.5">
              متابعة
            </Button>
          </form>
          <p className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
            مريض؟{' '}
            <Link to="/check-in" className="font-medium text-teal-700 underline-offset-2 hover:underline">
              احجز دورك من المنزل
            </Link>
            {' — '}
            <Link to="/" className="text-slate-500 underline-offset-2 hover:underline">
              الصفحة الرئيسية
            </Link>
          </p>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-500">{SITE_DEVELOPER_CREDIT_AR}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-gradient-to-b from-teal-50 to-slate-100 p-4 pb-8">
      <BrandMark size={56} className="rounded-2xl bg-white/80 p-2 shadow-md ring-1 ring-teal-100" />
      <Card title="تسجيل الدخول — أبين الصحي" className="w-full max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          <Input
            label="البريد الإلكتروني"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            placeholder="you@example.com"
          />
          <Input
            label="كلمة المرور"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
          />
          <Button type="submit" disabled={submitting} className="w-full justify-center py-2.5">
            {submitting ? 'جاري الدخول…' : 'دخول'}
          </Button>
        </form>
        <p className="mt-4 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
          مريض؟{' '}
          <Link to="/check-in" className="font-medium text-teal-700 underline-offset-2 hover:underline">
            احجز دورك من المنزل
          </Link>
          {' — '}
          <Link to="/" className="text-slate-500 underline-offset-2 hover:underline">
            الصفحة الرئيسية
          </Link>
        </p>
      </Card>
      <p className="text-center text-xs text-slate-500">{SITE_DEVELOPER_CREDIT_AR}</p>
    </div>
  )
}
