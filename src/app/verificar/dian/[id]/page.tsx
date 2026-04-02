import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function VerifyDianDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const doc = await prisma.dianElectronicDocument.findUnique({
    where: { id },
    select: {
      id: true,
      numero: true,
      status: true,
      direction: true,
      type: true,
      uuid: true,
      cufe: true,
      provider: true,
      providerRef: true,
      createdAt: true,
      transmittedAt: true,
      empresa: { select: { nombre: true, nit: true } },
      posInvoice: { select: { numero: true, clienteNombre: true, total: true } },
    },
  })

  if (!doc) notFound()

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(2,132,199,0.14),_transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eff6ff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-sky-200 bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Verificación DIAN
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">Documento DIAN identificado</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta consulta valida que el documento existe en SGDigital y conserva sus referencias electrónicas originales.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Documento</div>
              <div className="mt-2 text-lg font-semibold">{doc.numero || doc.posInvoice?.numero || doc.id}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
              <div className="mt-2 text-lg font-semibold">{doc.status}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tipo</div>
              <div className="mt-2 text-lg font-semibold">{doc.type}</div>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Empresa emisora</div>
                <div className="mt-2 text-base font-medium">{doc.empresa?.nombre || 'SGDigital Softwares'}</div>
                <div className="text-sm text-slate-500">NIT: {doc.empresa?.nit || 'No registrado'}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Transmitido</div>
                <div className="mt-2 text-base font-medium">{doc.transmittedAt ? new Date(doc.transmittedAt).toLocaleString('es-CO') : 'Pendiente'}</div>
                <div className="text-sm text-slate-500">Dirección: {doc.direction}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <div><span className="font-semibold text-slate-700">UUID:</span> <span className="break-all text-slate-600">{doc.uuid || 'No asignado'}</span></div>
            <div><span className="font-semibold text-slate-700">CUFE:</span> <span className="break-all text-slate-600">{doc.cufe || 'No asignado'}</span></div>
            <div><span className="font-semibold text-slate-700">Proveedor:</span> <span className="text-slate-600">{doc.provider || 'No definido'}</span></div>
            <div><span className="font-semibold text-slate-700">Ref. proveedor:</span> <span className="break-all text-slate-600">{doc.providerRef || 'No asignada'}</span></div>
            {doc.posInvoice ? (
              <div><span className="font-semibold text-slate-700">Factura origen:</span> <span className="text-slate-600">{doc.posInvoice.numero} · {doc.posInvoice.clienteNombre}</span></div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
          Si UUID, CUFE o referencia del proveedor no coinciden con el documento recibido, su autenticidad debe revisarse.
          <div className="mt-3">
            <Link href="/" className="font-medium text-sky-700 underline underline-offset-4">
              Ir al portal SGDigital
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}