import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

export default async function VerifyPosInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const invoice = await prisma.posInvoice.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      status: true,
      createdAt: true,
      clienteNombre: true,
      clienteDocumento: true,
      subtotal: true,
      iva: true,
      total: true,
      empresa: { select: { nombre: true, nit: true } },
    },
  })

  if (!invoice) notFound()

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.14),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-teal-200 bg-white/90 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8">
          <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Verificación oficial
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">Factura interna verificada</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta URL confirma que la factura fue generada desde SGDigital y conserva su identificador original.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Factura</div>
              <div className="mt-2 text-lg font-semibold">{invoice.numero}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
              <div className="mt-2 text-lg font-semibold">{invoice.status}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total</div>
              <div className="mt-2 text-lg font-semibold">{currency(invoice.total)}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Empresa emisora</div>
              <div className="mt-2 text-base font-medium">{invoice.empresa?.nombre || 'SGDigital Softwares'}</div>
              <div className="text-sm text-slate-500">NIT: {invoice.empresa?.nit || 'No registrado'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cliente</div>
              <div className="mt-2 text-base font-medium">{invoice.clienteNombre}</div>
              <div className="text-sm text-slate-500">Documento: {invoice.clienteDocumento || 'No registrado'}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Subtotal</div>
              <div className="mt-2 font-semibold">{currency(invoice.subtotal)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">IVA</div>
              <div className="mt-2 font-semibold">{currency(invoice.iva)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Emitida</div>
              <div className="mt-2 font-semibold">{new Date(invoice.createdAt).toLocaleString('es-CO')}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
          Si el número, estado o total no coinciden con el documento físico o PDF que recibiste, trátalo como inconsistencia.
          <div className="mt-3">
            <Link href="/" className="font-medium text-teal-700 underline underline-offset-4">
              Ir al portal SGDigital
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}