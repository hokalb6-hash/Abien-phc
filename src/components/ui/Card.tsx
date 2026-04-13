import type { ReactNode } from 'react'

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      {title ? (
        <h2 className="mb-3 text-base font-semibold text-slate-900 sm:mb-4 sm:text-lg">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}
