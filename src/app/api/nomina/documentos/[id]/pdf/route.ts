import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { buildPayrollEmployeeFullName } from '@/lib/payroll'
import { PayrollDocumentPDFCore } from '@/lib/payroll-document-pdf-template'
import { getReactPdfRenderer, pdfToBuffer } from '@/lib/react-pdf-node'

export const runtime = 'nodejs'

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function normalizeAssetUrl(value: unknown, origin: string): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw
  if (raw.startsWith('/')) return `${origin}${raw}`
  return null
}

function parseMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, 'READ')
  if (!access.ok) return access.response

  const { id } = await context.params
  const origin = new URL(request.url).origin

  const document = await prisma.payrollEmployeeDocument.findFirst({
    where: { id, empresaId: access.empresaId },
    include: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          secondLastName: true,
          documentType: true,
          documentNumber: true,
          jobTitle: true,
        },
      },
      period: { select: { label: true } },
      empresa: {
        select: {
          nombre: true,
          nit: true,
          direccion: true,
          telefono: true,
          logo: true,
        },
      },
    },
  })

  if (!document) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  const metadata = parseMetadata(document.metadata)
  const renderer = await getReactPdfRenderer()

  const pdfDoc = createElement(PayrollDocumentPDFCore, {
    pdf: {
      Document: renderer.Document,
      Page: renderer.Page,
      Text: renderer.Text,
      View: renderer.View,
      StyleSheet: renderer.StyleSheet,
      Image: renderer.Image,
    },
    company: {
      name: document.empresa.nombre,
      nit: document.empresa.nit,
      address: document.empresa.direccion,
      phone: document.empresa.telefono,
      logoUrl: normalizeAssetUrl(document.empresa.logo, origin),
    },
    document: {
      title: document.title,
      legalFormName: typeof metadata.legalFormName === 'string' ? metadata.legalFormName : null,
      category: document.category,
      documentType: document.documentType,
      employeeName: buildPayrollEmployeeFullName(document.employee),
      employeeDocument: `${document.employee.documentType} ${document.employee.documentNumber}`,
      employeeRole: document.employee.jobTitle,
      periodLabel: document.period?.label ?? 'Sin período',
      requestedAt: document.requestedAt?.toISOString() ?? null,
      deliveredAt: document.deliveredAt?.toISOString() ?? null,
      signedAt: document.signedAt?.toISOString() ?? null,
      expiresAt: document.expiresAt?.toISOString() ?? null,
      formSummary: typeof metadata.formSummary === 'string' ? metadata.formSummary : null,
      notes: document.notes,
      hrApprovalStatus: typeof metadata.hrApprovalStatus === 'string' ? metadata.hrApprovalStatus : 'PENDIENTE',
      hrApproverName: typeof metadata.hrApproverName === 'string' ? metadata.hrApproverName : null,
      hrApprovedAt: typeof metadata.hrApprovedAt === 'string' ? metadata.hrApprovedAt : null,
      directorApprovalStatus: typeof metadata.directorApprovalStatus === 'string' ? metadata.directorApprovalStatus : 'PENDIENTE',
      directorApproverName: typeof metadata.directorApproverName === 'string' ? metadata.directorApproverName : null,
      directorApprovedAt: typeof metadata.directorApprovedAt === 'string' ? metadata.directorApprovedAt : null,
      signatureStatus: document.signatureStatus,
      approvalStatus: typeof metadata.approvalStatus === 'string' ? metadata.approvalStatus : 'PENDIENTE',
    },
  })

  const buffer = await pdfToBuffer(pdfDoc)
  const filename = `${document.title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'documento-laboral'}.pdf`

  return new NextResponse(bufferToArrayBuffer(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}