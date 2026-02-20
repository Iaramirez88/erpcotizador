import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'READ')
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: {
      empresa: {
        select: {
          id: true,
          workspaceCode: true,
          nombre: true,
          nit: true,
          logo: true,
          registrationCodeHash: true,
        },
      },
    },
  })

  const empresa = sede?.empresa
  if (!empresa) {
    return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
  }

  const workspaceCode = empresa.workspaceCode || (await ensureWorkspaceCodeForEmpresa(empresa.id))

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa.id,
      workspaceCode,
      nombre: empresa.nombre,
      nit: empresa.nit,
      logo: empresa.logo,
      hasRegistrationCode: Boolean(empresa.registrationCodeHash),
    },
  })
}

export async function PUT(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: { empresaId: true },
  })

  const empresaId = sede?.empresaId
  if (!empresaId) {
    return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })
  }

  const nombreRaw = asString(body.nombre).trim()
  const nitRaw = asString(body.nit).trim()
  const logoRaw = asString(body.logo).trim()

  const updateData: {
    nombre?: string
    logo?: string | null
    registrationCodeHash?: string | null
    nit?: string
  } = {}

  if (nombreRaw) updateData.nombre = nombreRaw
  if (nitRaw) updateData.nit = nitRaw
  if (body.logo !== undefined) {
    updateData.logo = logoRaw ? logoRaw : null
  }

  if (Object.prototype.hasOwnProperty.call(body, 'registrationCode')) {
    const rc = body.registrationCode
    if (rc === null) {
      updateData.registrationCodeHash = null
    } else {
      const code = asString(rc).trim()
      if (code) {
        updateData.registrationCodeHash = await bcrypt.hash(code, 12)
      }
    }
  }

  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: updateData,
    select: { id: true, nombre: true, nit: true, logo: true, registrationCodeHash: true },
  })

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa.id,
      nombre: empresa.nombre,
      nit: empresa.nit,
      logo: empresa.logo,
      hasRegistrationCode: Boolean(empresa.registrationCodeHash),
    },
  })
}
