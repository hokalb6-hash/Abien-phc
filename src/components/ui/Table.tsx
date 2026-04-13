import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function Table({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch] ${className}`}
    >
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-slate-50">{children}</thead>
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
}

export function Tr({
  children,
  className = '',
  onClick,
  role,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  role?: string
}) {
  return (
    <tr className={className} onClick={onClick} role={role}>
      {children}
    </tr>
  )
}

export function Th({
  children,
  className = '',
  ...rest
}: {
  children: ReactNode
  className?: string
} & ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-start font-semibold text-slate-700 ${className}`}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  title,
  ...rest
}: {
  children: ReactNode
  className?: string
  title?: string
} & TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`px-4 py-3 text-slate-800 ${className}`} title={title} {...rest}>
      {children}
    </td>
  )
}
