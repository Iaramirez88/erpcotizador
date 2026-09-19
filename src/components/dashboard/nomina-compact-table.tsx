'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type NominaTableColumn<Row> = {
  key: string
  label: ReactNode
  className?: string
  headerClassName?: string
  render: (row: Row) => ReactNode
}

type NominaCompactTableProps<Row extends { id: string }> = {
  rows: Row[]
  columns: NominaTableColumn<Row>[]
  emptyMessage: string
  minWidth?: string
}

export function NominaCompactTable<Row extends { id: string }>({ rows, columns, emptyMessage, minWidth = '1000px' }: NominaCompactTableProps<Row>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>{columns.map((column) => <th key={column.key} className={cn('px-3 py-2.5', column.headerClassName)}>{column.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={row.id} className="align-middle hover:bg-slate-50/70">
              {columns.map((column) => <td key={column.key} className={cn('px-3 py-2.5', column.className)}>{column.render(row)}</td>)}
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-500">{emptyMessage}</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

export function NominaStatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  const className = normalized.includes('COMPLET') || normalized.includes('RESUELT') || normalized.includes('PAGAD') || normalized.includes('CERRAD') || normalized.includes('APLICAD')
    ? 'border-emerald-400 bg-emerald-500 text-white'
    : normalized.includes('BLOQUE') || normalized.includes('RECHAZ') || normalized.includes('DESCART') || normalized.includes('VENCID') || normalized.includes('ANULAD')
      ? 'border-rose-400 bg-rose-500 text-white'
      : normalized.includes('CURSO') || normalized.includes('GESTION') || normalized.includes('INVESTIG') || normalized.includes('CALCULAD') || normalized.includes('VALIDAD')
        ? 'border-amber-300 bg-amber-400 text-slate-950'
        : normalized.includes('ACTIV') || normalized.includes('FINALISTA') || normalized.includes('COMITE') || normalized.includes('CONTABILIZ')
          ? 'border-sky-400 bg-sky-500 text-white'
          : 'border-slate-800 bg-slate-900 text-white'

  return <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase shadow-sm', className)}>{status.replaceAll('_', ' ')}</span>
}