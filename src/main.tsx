import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('عنصر #root غير موجود في index.html')
}

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: { direction: 'rtl', fontFamily: 'Tajawal, sans-serif' },
          }}
        />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
