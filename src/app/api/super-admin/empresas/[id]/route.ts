import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { BillingCycle, ModuleKey, PlanTier } from '@prisma/client'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { ensureWorkspaceCodeForEmpresa } from '@/lib/workspace-code'

export const runtime = 'nodejs'

function requireSuperAdmin(session: { user?: { role?: string; email?: string | null } } | null) {
  const email = session?.user?.email ?? null
  if (!session?.user || !isSuperAdminEmail(email)) return null
  return session
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v ? v : null
}

function isPlanTier(value: unknown): value is PlanTier {
  return value === 'CRM' || value === 'BASIC' || value === 'MEDIO' || value === 'INTERMEDIO' || value === 'FULL'
}

function isBillingCycle(value: unknown): value is BillingCycle {
  return value === 'MONTHLY' || value === 'YEARLY'
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function addYears(date: Date, years: number) {
  const copy = new Date(date)
  copy.setFullYear(copy.getFullYear() + years)
  return copy
}

function parseQuotedModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ModuleKey => typeof item === 'string')
}

type PatchBody = {
  nombre?: unknown
  nit?: unknown
  direccion?: unknown
  telefono?: unknown
  whatsapp?: unknown
  companyEmail?: unknown
  email?: unknown
  logo?: unknown
  planTier?: unknown
  billingCycle?: unknown
  isPaid?: unknown
  planValidUntil?: unknown
  clearTrial?: unknown
  planOwnerEmail?: unknown
}

function parsePlanValidUntil(value: unknown): Date | null | 'invalid' {
  if (value == null) return null
  if (typeof value !== 'string') return 'invalid'
  const normalized = value.trim()
  if (!normalized) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const next = new Date(`${normalized}T23:59:59`)
    return Number.isNaN(next.getTime()) ? 'invalid' : next
  }

  const next = new Date(normalized)
  return Number.isNaN(next.getTime()) ? 'invalid' : next
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      workspaceCode: true,
      planOwnerUserId: true,
      nombre: true,
      nit: true,
      direccion: true,
      telefono: true,
      whatsapp: true,
      email: true,
      logo: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      trialTier: true,
      trialStartedAt: true,
      trialValidUntil: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
      stripeSubscriptionStatus: true,
      stripeCurrentPeriodEnd: true,
      stripeCancelAtPeriodEnd: true,
      createdAt: true,
      updatedAt: true,
      registrationCodeHash: true,
      billingInvoices: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          provider: true,
          status: true,
          amountCOP: true,
          currency: true,
          planTier: true,
          billingCycle: true,
          paidAt: true,
          expiresAt: true,
          externalReference: true,
          boldPaymentLinkId: true,
          paymentMethod: true,
          quotedModulesJson: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!empresa?.id) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const workspaceCode = empresa.workspaceCode || (await ensureWorkspaceCodeForEmpresa(empresa.id))

  const planOwnerEmail = empresa.planOwnerUserId
    ? (
        await prisma.user.findUnique({ where: { id: empresa.planOwnerUserId }, select: { email: true } })
      )?.email ?? null
    : null

  return NextResponse.json({
    ok: true,
    empresa: {
      ...empresa,
      workspaceCode,
      hasCompanyCode: Boolean(empresa.registrationCodeHash),
      planOwnerEmail,
      billingInvoices: empresa.billingInvoices.map((invoice) => ({
        ...invoice,
        quotedModules: parseQuotedModules(invoice.quotedModulesJson),
      })),
    },
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = requireSuperAdmin(await auth())
  if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

  const { id } = await ctx.params
  const empresaId = (id ?? '').trim()
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa inválida' }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as PatchBody

  const data: Record<string, unknown> = {}

  if (typeof body.nombre === 'string') {
    const v = body.nombre.trim()
    if (!v) return NextResponse.json({ ok: false, error: 'Nombre no puede ser vacío.' }, { status: 400 })
    data.nombre = v
  }
  if (typeof body.nit === 'string') {
    const v = body.nit.trim()
    if (!v) return NextResponse.json({ ok: false, error: 'NIT no puede ser vacío.' }, { status: 400 })
    data.nit = v
  }

  if ('direccion' in body) data.direccion = normalizeNullableString(body.direccion)
  if ('telefono' in body) data.telefono = normalizeNullableString(body.telefono)
  if ('whatsapp' in body) data.whatsapp = normalizeNullableString(body.whatsapp)
  if ('logo' in body) data.logo = normalizeNullableString(body.logo)

  if ('companyEmail' in body || 'email' in body) {
    const v = normalizeNullableString(body.companyEmail ?? body.email)
    data.email = v
  }

  if ('planTier' in body) {
    if (body.planTier == null) {
      // no-op
    } else if (!isPlanTier(body.planTier)) {
      return NextResponse.json({ ok: false, error: 'Plan inválido.' }, { status: 400 })
    } else {
      data.planTier = body.planTier
    }
  }

  if ('billingCycle' in body) {
    if (body.billingCycle == null) {
      // no-op
    } else if (!isBillingCycle(body.billingCycle)) {
      return NextResponse.json({ ok: false, error: 'Ciclo inválido.' }, { status: 400 })
    } else {
      data.billingCycle = body.billingCycle
    }
  }

  if ('isPaid' in body) {
    const isPaid = body.isPaid === true
    if (isPaid) {
      const cycle = (data.billingCycle as BillingCycle | undefined) ?? undefined
      const now = new Date()
      const effectiveCycle = cycle ?? (await prisma.empresa.findUnique({ where: { id: empresaId }, select: { billingCycle: true } }))?.billingCycle ?? 'MONTHLY'
      data.planValidUntil = effectiveCycle === 'YEARLY' ? addYears(now, 1) : addMonths(now, 1)
      data.trialTier = null
      data.trialStartedAt = null
      data.trialValidUntil = null
    } else {
      data.planValidUntil = null
    }
  }

  if ('planValidUntil' in body) {
    const parsed = parsePlanValidUntil(body.planValidUntil)
    if (parsed === 'invalid') {
      return NextResponse.json({ ok: false, error: 'Fecha de vigencia inválida.' }, { status: 400 })
    }
    data.planValidUntil = parsed
    if (parsed) {
      data.trialTier = null
      data.trialStartedAt = null
      data.trialValidUntil = null
    }
  }

  if (body.clearTrial === true) {
    data.trialTier = null
    data.trialStartedAt = null
    data.trialValidUntil = null
  }

  const planOwnerEmailRaw = normalizeNullableString(body.planOwnerEmail)
  const planOwnerEmail = planOwnerEmailRaw ? planOwnerEmailRaw.toLowerCase() : null

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.empresa.update({ where: { id: empresaId }, data: data as never, select: { id: true } })
      }

      if (planOwnerEmail) {
        const user = await tx.user.findUnique({ where: { email: planOwnerEmail }, select: { id: true, empresaId: true } })
        if (!user?.id) throw new Error('PLAN_OWNER_USER_NOT_FOUND')
        if (user.empresaId && user.empresaId !== empresaId) throw new Error('PLAN_OWNER_USER_ALREADY_IN_OTHER_EMPRESA')

        if (!user.empresaId) {
          await tx.user.update({ where: { id: user.id }, data: { empresaId }, select: { id: true } })
        }

        await tx.empresa.update({ where: { id: empresaId }, data: { planOwnerUserId: user.id }, select: { id: true } })

        await tx.userGlobalAccess.upsert({
          where: { userId: user.id },
          create: { userId: user.id, empresaId, level: 'ADMIN' },
          update: { empresaId, level: 'ADMIN' },
        })
      }
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error inesperado'
    if (message === 'PLAN_OWNER_USER_NOT_FOUND') {
      return NextResponse.json(
        { ok: false, error: 'El usuario (email) asignado como propietario no existe. Debe registrarse primero.' },
        { status: 400 }
      )
    }
    if (message === 'PLAN_OWNER_USER_ALREADY_IN_OTHER_EMPRESA') {
      return NextResponse.json(
        { ok: false, error: 'El usuario (email) asignado ya pertenece a otra empresa.' },
        { status: 400 }
      )
    }
    if (/unique|duplicate/i.test(message)) {
      return NextResponse.json({ ok: false, error: 'NIT ya existe (duplicado).' }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar la empresa.' }, { status: 500 })
  }
}
