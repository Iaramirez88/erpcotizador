import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWebsitePerformanceAdvice } from '@/lib/website-performance-ai'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    const { projectId } = await context.params
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const auditId = typeof body?.auditId === 'string' ? body.auditId : ''
    const project = await prisma.websiteProject.findFirst({ where: { id: projectId, empresaId: guard.access.empresaId! }, select: { nombre: true } })
    if (!project) return NextResponse.json({ error: 'Sitio no encontrado.' }, { status: 404 })
    const audit = await prisma.websiteSeoAudit.findFirst({ where: { id: auditId, websiteProjectId: projectId, empresaId: guard.access.empresaId! }, select: { id: true, targetUrl: true, metricsJson: true, createdAt: true } })
    if (!audit) return NextResponse.json({ error: 'Ejecuta primero una consulta de rendimiento.' }, { status: 404 })
    const advice = await generateWebsitePerformanceAdvice({ siteName: project.nombre, targetUrl: audit.targetUrl, audit })
    return NextResponse.json({ success: true, data: advice })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el plan de mejora.'
    console.error('Error generando asesoría de rendimiento:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}