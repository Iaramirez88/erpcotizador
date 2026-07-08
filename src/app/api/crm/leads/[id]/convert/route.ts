import { NextResponse } from 'next/server'
import { AccessLevel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function assertLeadCapabilityAccess(args: {
  sedeId: string
  empresaId: string
  action: 'UPDATE'
}) {
  const sede = await prisma.sede.findUnique({ where: { id: args.sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== args.empresaId) {
    return { response: NextResponse.json({ error: 'sedeId inválido' }, { status: 400 }) }
  }

  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'LEADS',
    action: args.action,
    scope: 'SEDE',
    sedeId: sede.id,
    allowLegacyFallback: false,
  })

  return access.ok ? null : { response: access.response }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'LEADS',
      action: 'UPDATE',
      scope: 'SEDE',
      allowLegacyFallback: false,
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null

    const lead = await prisma.crmLead.findUnique({
      where: { id },
      include: {
        convertedCliente: { select: { id: true, nombre: true, documento: true } },
      },
    })

    if (!lead || lead.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    }

    if (lead.sedeId) {
      const denied = await assertLeadCapabilityAccess({ sedeId: lead.sedeId, empresaId: access.empresaId, action: 'UPDATE' })
      if (denied) return denied.response
    }

    if (lead.convertedClienteId && lead.convertedCliente) {
      return NextResponse.json({
        success: true,
        data: {
          lead,
          cliente: lead.convertedCliente,
        },
      })
    }

    const clienteId = normalizeString(body?.clienteId)
    const overrideNombre = normalizeString(body?.nombre)
    const tipoDocumento = normalizeString(body?.tipoDocumento)
    const documento = normalizeString(body?.documento || lead.documento)
    const email = normalizeString(body?.email || lead.email)
    const telefono = normalizeString(body?.telefono || lead.telefono)
    const celular = normalizeString(body?.celular || lead.celular)
    const direccion = normalizeString(body?.direccion || lead.direccion)
    const ciudad = normalizeString(body?.ciudad || lead.ciudad)
    const nombre = overrideNombre || lead.nombre

    const result = await prisma.$transaction(async (tx) => {
      let cliente = null as null | { id: string; nombre: string; documento: string }

      if (clienteId) {
        const existing = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { id: true, nombre: true, documento: true, empresaId: true },
        })
        if (!existing || existing.empresaId !== access.empresaId) {
          return NextResponse.json({ error: 'clienteId inválido' }, { status: 400 })
        }
        cliente = { id: existing.id, nombre: existing.nombre, documento: existing.documento }
      } else {
        if (!documento) {
          return NextResponse.json({ error: 'Se requiere documento o clienteId para convertir el lead' }, { status: 400 })
        }

        const byDocumento = await tx.cliente.findUnique({
          where: { documento },
          select: { id: true, nombre: true, documento: true, empresaId: true },
        })

        if (byDocumento) {
          if (byDocumento.empresaId !== access.empresaId) {
            return NextResponse.json({ error: 'Ya existe un cliente con ese documento en otra empresa' }, { status: 409 })
          }
          cliente = { id: byDocumento.id, nombre: byDocumento.nombre, documento: byDocumento.documento }
        } else {
          if (!tipoDocumento) {
            return NextResponse.json({ error: 'tipoDocumento es requerido para crear el cliente' }, { status: 400 })
          }

          const created = await tx.cliente.create({
            data: {
              nombre,
              tipoDocumento,
              documento,
              email: email || null,
              telefono: telefono || null,
              celular: celular || null,
              direccion: direccion || null,
              ciudad: ciudad || null,
              empresaId: access.empresaId,
              sedeId: lead.sedeId ?? access.sedeId,
            },
            select: { id: true, nombre: true, documento: true },
          })
          cliente = created
        }
      }

      const updatedLead = await tx.crmLead.update({
        where: { id: lead.id },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
          convertedClienteId: cliente.id,
        },
        include: {
          convertedCliente: { select: { id: true, nombre: true, documento: true } },
          ownerUser: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      })

      await tx.crmContact.updateMany({
        where: { empresaId: access.empresaId, leadId: updatedLead.id },
        data: { clienteId: cliente.id, leadId: null },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: updatedLead.sedeId,
          type: 'OTHER',
          summary: `Lead convertido a cliente: ${cliente.nombre}`,
          details: cliente.documento ? `Documento: ${cliente.documento}` : null,
          leadId: updatedLead.id,
          clienteId: cliente.id,
          occurredAt: new Date(),
          createdById: access.userId,
        },
      })

      return NextResponse.json({ success: true, data: { lead: updatedLead, cliente } })
    })

    return result
  } catch (error) {
    console.error('Error convirtiendo lead CRM:', error)
    return NextResponse.json({ error: 'Error convirtiendo lead CRM' }, { status: 500 })
  }
}