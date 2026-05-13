import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDefaultPlanTier } from '@/lib/plans'
import { resolvePaywallState } from '@/lib/plan-access'
import type { ModuleKey } from '@prisma/client'
import { getPlanModulePriceRows } from '@/lib/plan-module-prices'
import { getManagedPlanByTier, getManagedPlans } from '@/lib/managed-plans'
import { getCrmStorageUsageSummary } from '@/lib/crm-files'

export const runtime = 'nodejs'

function parseQuotedModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ModuleKey => typeof item === 'string')
}

export async function GET() {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })

    const userId = session.user.id
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { empresaId: true },
    })

    const empresa = user?.empresaId
      ? await prisma.empresa.findUnique({
          where: { id: user.empresaId },
          select: {
            nit: true,
            registrationCodeHash: true,
            planTier: true,
            billingCycle: true,
            planValidUntil: true,
            trialTier: true,
            trialStartedAt: true,
            trialValidUntil: true,
          },
        })
      : null

    const invoices = user?.empresaId
      ? await prisma.billingInvoice.findMany({
          where: { empresaId: user.empresaId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            provider: true,
            status: true,
            planTier: true,
            billingCycle: true,
            currency: true,
            amountCOP: true,
            discountPct: true,
            externalReference: true,
            boldCheckoutUrl: true,
            quotedModulesJson: true,
            expiresAt: true,
            paidAt: true,
            createdAt: true,
          },
        })
      : []

    const lastInvoice = invoices[0] ?? null
    const modulePrices = await getPlanModulePriceRows()

    const paywall = empresa ? resolvePaywallState(empresa, new Date()) : null

    const resolvedTier = paywall?.effectiveTier ?? empresa?.planTier ?? getDefaultPlanTier()
    const [plan, allPlans, storageUsage] = await Promise.all([
      getManagedPlanByTier(resolvedTier),
      getManagedPlans(),
      user?.empresaId ? getCrmStorageUsageSummary({ empresaId: user.empresaId }) : Promise.resolve(null),
    ])

    return NextResponse.json({
      ok: true,
      current: plan,
      effective: paywall
        ? {
            planTier: paywall.effectiveTier,
            paywall: {
              show: paywall.show,
              blocking: paywall.blocking,
              reason: paywall.reason,
            },
            trial: {
              tier: paywall.trial.tier,
              startedAt: paywall.trial.startedAt ? paywall.trial.startedAt.toISOString() : null,
              validUntil: paywall.trial.validUntil ? paywall.trial.validUntil.toISOString() : null,
              isActive: paywall.trial.isActive,
              isExpired: paywall.trial.isExpired,
              daysLeft: paywall.trial.daysLeft,
            },
          }
        : null,
      empresa: empresa
        ? {
            planTier: empresa.planTier,
            billingCycle: empresa.billingCycle,
            planValidUntil: empresa.planValidUntil ? empresa.planValidUntil.toISOString() : null,
            trialTier: empresa.trialTier,
            trialStartedAt: empresa.trialStartedAt ? empresa.trialStartedAt.toISOString() : null,
            trialValidUntil: empresa.trialValidUntil ? empresa.trialValidUntil.toISOString() : null,
          }
        : null,
      lastInvoice: lastInvoice
        ? {
            id: lastInvoice.id,
            provider: lastInvoice.provider,
            status: lastInvoice.status,
            planTier: lastInvoice.planTier,
            billingCycle: lastInvoice.billingCycle,
            currency: lastInvoice.currency,
            amountCOP: lastInvoice.amountCOP,
            discountPct: lastInvoice.discountPct,
            externalReference: lastInvoice.externalReference,
            checkoutUrl: lastInvoice.boldCheckoutUrl,
            quotedModules: parseQuotedModules(lastInvoice.quotedModulesJson),
            expiresAt: lastInvoice.expiresAt ? lastInvoice.expiresAt.toISOString() : null,
            paidAt: lastInvoice.paidAt ? lastInvoice.paidAt.toISOString() : null,
            createdAt: lastInvoice.createdAt.toISOString(),
          }
        : null,
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        provider: invoice.provider,
        status: invoice.status,
        planTier: invoice.planTier,
        billingCycle: invoice.billingCycle,
        currency: invoice.currency,
        amountCOP: invoice.amountCOP,
        discountPct: invoice.discountPct,
        externalReference: invoice.externalReference,
        checkoutUrl: invoice.boldCheckoutUrl,
        quotedModules: parseQuotedModules(invoice.quotedModulesJson),
        expiresAt: invoice.expiresAt ? invoice.expiresAt.toISOString() : null,
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        createdAt: invoice.createdAt.toISOString(),
      })),
      modulePrices,
      all: allPlans,
        storageUsage,
      devDefault: getDefaultPlanTier(),
    })
  } catch (error: unknown) {
    console.error('GET /api/plan error:', error)
    const msg = error instanceof Error ? error.message : 'Error inesperado'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
