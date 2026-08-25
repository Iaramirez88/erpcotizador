import 'dotenv/config'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { ensureRopCompanyForEmpresa, createRopRatingForUser, disputeRopRatingForUser } from '../src/lib/rop'
import { recomputeRopTrustScoreForEmpresa } from '../src/lib/rop-trust'

function buildSuffix() {
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
}

async function createCompanyFixture(label: string, suffix: string) {
  const empresa = await prisma.empresa.create({
    data: {
      nombre: `ROP QA ${label} ${suffix}`,
      nit: `ROP-QA-${label}-${suffix}`.slice(0, 40),
      workspaceCode: `ROPQA${label}${suffix.replace(/[^A-Za-z0-9]/g, '').slice(0, 18)}`,
      email: `rop.qa.${label.toLowerCase()}.${suffix}@local.test`,
    },
    select: { id: true, nombre: true },
  })

  const sede = await prisma.sede.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Principal',
    },
    select: { id: true },
  })

  const user = await prisma.user.create({
    data: {
      name: `ROP QA ${label}`,
      email: `rop.user.${label.toLowerCase()}.${suffix}@local.test`,
      empresaId: empresa.id,
      sedeDefaultId: sede.id,
      role: 'USER',
    },
    select: { id: true },
  })

  const cliente = await prisma.cliente.create({
    data: {
      nombre: `Cliente ROP QA ${label}`,
      tipoDocumento: 'NIT',
      documento: `CLI-ROP-QA-${label}-${suffix}`.slice(0, 60),
      empresaId: empresa.id,
      sedeId: sede.id,
    },
    select: { id: true },
  })

  const ropCompany = await ensureRopCompanyForEmpresa(empresa.id)

  return {
    empresaId: empresa.id,
    sedeId: sede.id,
    userId: user.id,
    clienteId: cliente.id,
    ropCompanyId: ropCompany.id,
  }
}

async function main() {
  const suffix = buildSuffix()
  const target = await createCompanyFixture('TARGET', suffix)
  const partner = await createCompanyFixture('PARTNER', suffix)
  const partnerTwo = await createCompanyFixture('PARTNERB', suffix)

  const baseline = await recomputeRopTrustScoreForEmpresa({
    empresaId: target.empresaId,
    reason: 'WORK_ORDER_CLOSED',
    sourceRef: `qa:${suffix}:baseline`,
  })

  await prisma.ordenTrabajo.create({
    data: {
      numero: `OT-QA-${suffix}-SUCCESS`,
      sedeId: target.sedeId,
      clienteId: target.clienteId,
      vendedorId: target.userId,
      estado: 'CERRADO',
      fechaInicio: new Date(Date.now() - 1000 * 60 * 60 * 24),
      fechaEntrega: new Date(Date.now() + 1000 * 60 * 60 * 24),
      subtotal: 100000,
      iva: 19000,
      total: 119000,
    },
  })

  const afterSuccessfulClose = await recomputeRopTrustScoreForEmpresa({
    empresaId: target.empresaId,
    reason: 'WORK_ORDER_CLOSED',
    sourceRef: `qa:${suffix}:success-close`,
  })

  assert.ok(
    afterSuccessfulClose.summary.overallScore > baseline.summary.overallScore,
    `Trust no mejoró tras cierre exitoso: baseline=${baseline.summary.overallScore}, after=${afterSuccessfulClose.summary.overallScore}`,
  )

  await prisma.ordenTrabajo.create({
    data: {
      numero: `OT-QA-${suffix}-CANCEL`,
      sedeId: target.sedeId,
      clienteId: target.clienteId,
      vendedorId: target.userId,
      estado: 'CANCELADA',
      subtotal: 50000,
      iva: 9500,
      total: 59500,
    },
  })

  const afterCancellation = await recomputeRopTrustScoreForEmpresa({
    empresaId: target.empresaId,
    reason: 'WORK_ORDER_CLOSED',
    sourceRef: `qa:${suffix}:cancelled-close`,
  })

  assert.ok(
    afterCancellation.summary.overallScore < afterSuccessfulClose.summary.overallScore,
    `Trust no bajó tras cancelación: success=${afterSuccessfulClose.summary.overallScore}, cancel=${afterCancellation.summary.overallScore}`,
  )

  const service = await prisma.ropServiceCatalog.findFirst({
    where: { isActive: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  if (!service) {
    throw new Error('No existe catálogo ROP activo. Ejecuta: npm run seed:rop-catalog')
  }

  const collaboration = await prisma.ropCollaborationHistory.create({
    data: {
      leadCompanyId: partner.ropCompanyId,
      partnerCompanyId: target.ropCompanyId,
      serviceCatalogId: service.id,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      completedAt: new Date(),
      outcomeStatus: 'SUCCESS',
      deliveredQuantity: 10,
      grossValue: 500000,
      currencyCode: 'COP',
      slaMet: true,
    },
    select: { id: true },
  })

  const rated = await createRopRatingForUser(partner.userId, collaboration.id, {
    qualityScore: 5,
    timelinessScore: 5,
    communicationScore: 5,
    commentPublic: 'QA Trust rating',
  })

  assert.ok(rated.trustImpact !== null, 'El rating no devolvió impacto de Trust.')

  const disputed = await disputeRopRatingForUser(target.userId, rated.ratingId, {
    reason: 'QA dispute scenario',
  })

  assert.equal(disputed.disputeFlag, true)
  assert.equal(disputed.moderationStatus, 'HIDDEN')
  assert.ok(disputed.trustImpact !== null, 'La disputa no devolvió impacto de Trust.')
  assert.ok(
    Number(disputed.trustImpact?.overallScore ?? 0) < Number(rated.trustImpact?.overallScore ?? 0),
    `Trust no bajó tras disputa: rated=${rated.trustImpact?.overallScore}, disputed=${disputed.trustImpact?.overallScore}`,
  )

  const antiGamingTarget = await createCompanyFixture('ANTIGAME', suffix)
  const antiGamingPartnerA = await createCompanyFixture('PAIRA', suffix)
  const antiGamingPartnerB = await createCompanyFixture('PAIRB', suffix)

  const collaborationA1 = await prisma.ropCollaborationHistory.create({
    data: {
      leadCompanyId: antiGamingPartnerA.ropCompanyId,
      partnerCompanyId: antiGamingTarget.ropCompanyId,
      serviceCatalogId: service.id,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 72),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      outcomeStatus: 'SUCCESS',
      deliveredQuantity: 8,
      grossValue: 350000,
      currencyCode: 'COP',
      slaMet: true,
    },
    select: { id: true },
  })

  await createRopRatingForUser(antiGamingPartnerA.userId, collaborationA1.id, {
    qualityScore: 5,
    timelinessScore: 5,
    communicationScore: 5,
    commentPublic: 'Primer rating pareja A',
  })

  const collaborationB1 = await prisma.ropCollaborationHistory.create({
    data: {
      leadCompanyId: antiGamingPartnerB.ropCompanyId,
      partnerCompanyId: antiGamingTarget.ropCompanyId,
      serviceCatalogId: service.id,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      outcomeStatus: 'SUCCESS',
      deliveredQuantity: 7,
      grossValue: 250000,
      currencyCode: 'COP',
      slaMet: false,
    },
    select: { id: true },
  })

  const afterMixedPairs = await createRopRatingForUser(antiGamingPartnerB.userId, collaborationB1.id, {
    qualityScore: 1,
    timelinessScore: 1,
    communicationScore: 1,
    commentPublic: 'Rating bajo pareja B',
  })

  const collaborationA2 = await prisma.ropCollaborationHistory.create({
    data: {
      leadCompanyId: antiGamingPartnerA.ropCompanyId,
      partnerCompanyId: antiGamingTarget.ropCompanyId,
      serviceCatalogId: service.id,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
      outcomeStatus: 'SUCCESS',
      deliveredQuantity: 9,
      grossValue: 375000,
      currencyCode: 'COP',
      slaMet: true,
    },
    select: { id: true },
  })

  const afterRepeatedPair = await createRopRatingForUser(antiGamingPartnerA.userId, collaborationA2.id, {
    qualityScore: 5,
    timelinessScore: 5,
    communicationScore: 5,
    commentPublic: 'Segundo rating pareja A',
  })

  assert.equal(
    Number(afterRepeatedPair.trustImpact?.overallScore ?? 0),
    Number(afterMixedPairs.trustImpact?.overallScore ?? 0),
    `La misma pareja siguió moviendo el Trust: mixed=${afterMixedPairs.trustImpact?.overallScore}, repeated=${afterRepeatedPair.trustImpact?.overallScore}`,
  )

  const selfCollaboration = await prisma.ropCollaborationHistory.create({
    data: {
      leadCompanyId: antiGamingTarget.ropCompanyId,
      partnerCompanyId: antiGamingTarget.ropCompanyId,
      serviceCatalogId: service.id,
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
      outcomeStatus: 'SUCCESS',
      deliveredQuantity: 1,
      grossValue: 10000,
      currencyCode: 'COP',
      slaMet: true,
    },
    select: { id: true },
  })

  await assert.rejects(
    () => createRopRatingForUser(antiGamingTarget.userId, selfCollaboration.id, {
      qualityScore: 5,
      timelinessScore: 5,
      communicationScore: 5,
      commentPublic: 'Self rating should fail',
    }),
    /ROP_SELF_RATING_NOT_ALLOWED/,
  )

  console.log('ROP Trust QA OK')
  console.log(`baseline=${baseline.summary.overallScore}`)
  console.log(`afterSuccessfulClose=${afterSuccessfulClose.summary.overallScore}`)
  console.log(`afterCancellation=${afterCancellation.summary.overallScore}`)
  console.log(`afterRating=${rated.trustImpact?.overallScore}`)
  console.log(`afterDispute=${disputed.trustImpact?.overallScore}`)
  console.log(`afterMixedPairs=${afterMixedPairs.trustImpact?.overallScore}`)
  console.log(`afterRepeatedPair=${afterRepeatedPair.trustImpact?.overallScore}`)
}

main()
  .catch((error) => {
    console.error('ROP Trust QA FAIL')
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })