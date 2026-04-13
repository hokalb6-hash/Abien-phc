import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: unknown
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/** يعرض رسالة بدل شاشة بيضاء عند تعطل React */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('خطأ في الواجهة:', error, info.componentStack)
  }

  render() {
    if (this.state.error != null) {
      return (
        <div
          dir="rtl"
          style={{
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#f8fafc',
            color: '#0f172a',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>حدث خطأ في التطبيق</h1>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            افتح أدوات المطوّر (F12) → تبويب Console لرؤية التفاصيل، ثم أعد تحميل الصفحة.
          </p>
          <pre
            style={{
              fontSize: '0.8rem',
              overflow: 'auto',
              padding: '1rem',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
            }}
          >
            {errorMessage(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              borderRadius: '8px',
              border: 'none',
              background: '#0d9488',
              color: '#fff',
            }}
          >
            إعادة تحميل
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
