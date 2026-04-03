import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function currency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

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

  if (!invoice) {
    return new NextResponse('<h1>404</h1><p>Factura no encontrada.</p>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verificación factura ${escapeHtml(invoice.numero)}</title>
  <style>
    body{font-family:Arial,sans-serif;background:linear-gradient(180deg,#f8fafc,#ecfeff);color:#0f172a;margin:0;padding:32px}
    .card{max-width:780px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08)}
    .badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    h1{font-size:32px;margin:18px 0 6px} .muted{color:#475569} .grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:24px}
    .item{border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc}.k{font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:.12em}.v{margin-top:8px;font-weight:700}
    @media (max-width:700px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Verificación oficial</div>
    <h1>Factura interna verificada</h1>
    <p class="muted">Este documento existe en SGDigital y conserva su identificador original.</p>
    <div class="grid">
      <div class="item"><div class="k">Factura</div><div class="v">${escapeHtml(invoice.numero)}</div></div>
      <div class="item"><div class="k">Estado</div><div class="v">${escapeHtml(invoice.status)}</div></div>
      <div class="item"><div class="k">Total</div><div class="v">${escapeHtml(currency(invoice.total))}</div></div>
    </div>
    <div class="grid">
      <div class="item"><div class="k">Empresa</div><div class="v">${escapeHtml(invoice.empresa?.nombre || 'SGDigital Softwares')}</div></div>
      <div class="item"><div class="k">Cliente</div><div class="v">${escapeHtml(invoice.clienteNombre)}</div></div>
      <div class="item"><div class="k">Documento</div><div class="v">${escapeHtml(invoice.clienteDocumento || 'No registrado')}</div></div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}