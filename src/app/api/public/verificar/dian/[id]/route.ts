import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

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
      empresa: { select: { nombre: true, nit: true } },
    },
  })

  if (!doc) {
    return new NextResponse('<h1>404</h1><p>Documento DIAN no encontrado.</p>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verificación DIAN ${escapeHtml(doc.numero || doc.id)}</title>
  <style>
    body{font-family:Arial,sans-serif;background:linear-gradient(180deg,#f8fafc,#eff6ff);color:#0f172a;margin:0;padding:32px}
    .card{max-width:820px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:24px;padding:28px;box-shadow:0 20px 60px rgba(15,23,42,.08)}
    .badge{display:inline-block;padding:8px 12px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    h1{font-size:32px;margin:18px 0 6px}.muted{color:#475569}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:24px}.item{border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc}.k{font-size:12px;text-transform:uppercase;color:#64748b;letter-spacing:.12em}.v{margin-top:8px;font-weight:700;word-break:break-word}@media (max-width:700px){.grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Verificación DIAN</div>
    <h1>Documento DIAN identificado</h1>
    <p class="muted">Este documento existe en SGDigital y conserva sus referencias electrónicas principales.</p>
    <div class="grid">
      <div class="item"><div class="k">Documento</div><div class="v">${escapeHtml(doc.numero || doc.id)}</div></div>
      <div class="item"><div class="k">Estado</div><div class="v">${escapeHtml(doc.status)}</div></div>
      <div class="item"><div class="k">Tipo</div><div class="v">${escapeHtml(doc.type)}</div></div>
      <div class="item"><div class="k">Dirección</div><div class="v">${escapeHtml(doc.direction)}</div></div>
      <div class="item"><div class="k">UUID</div><div class="v">${escapeHtml(doc.uuid || 'No asignado')}</div></div>
      <div class="item"><div class="k">CUFE</div><div class="v">${escapeHtml(doc.cufe || 'No asignado')}</div></div>
      <div class="item"><div class="k">Proveedor</div><div class="v">${escapeHtml(doc.provider || 'No definido')}</div></div>
      <div class="item"><div class="k">Ref. proveedor</div><div class="v">${escapeHtml(doc.providerRef || 'No asignada')}</div></div>
    </div>
  </div>
</body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}