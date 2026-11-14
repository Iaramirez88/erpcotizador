/**
 * Backfill M5 · CRM captación de leads: contacto canónico por lead.
 *
 * Qué hace (idempotente, repetible):
 * 1) Para cada lead sin `contactId`, resuelve su contacto con el motor compartido
 *    (`crm-contact-identity`): documento → email normalizado → teléfono
 *    normalizado → sufijo de 10 dígitos. Si no existe, lo crea.
 * 2) Enlaza el lead con el contacto canónico (nunca con uno fusionado).
 * 3) Propaga `contactId` a capturas, conversaciones, oportunidades y actividades.
 * 4) Actualiza `lastInteractionAt` del contacto con la última actividad conocida.
 *
 * No borra nada y no toca leads que ya tienen contacto, salvo la propagación.
 *
 * Ejecutar:
 *   npx tsx scripts/backfill-crm-contacts.ts --dry-run
 *   npx tsx scripts/backfill-crm-contacts.ts
 *
 * Opcionales:
 *   --empresa <empresaId>
 *   --batch <n>        (por defecto 200)
 *   --limit <n>        (procesa como máximo n leads, útil para probar)
 */

import dotenv from 'dotenv'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '.prisma/client/default'
import {
  ensureContactIdentity,
  findContactBySignals,
  normalizeContactPhoneDigits,
  propagateContactToLeadChildren,
  touchContactInteraction,
} from '../src/lib/crm-contact-identity'

dotenv.config()

type Args = {
  dryRun: boolean
  empresaId?: string
  batchSize: number
  limit?: number
}

type LeadRow = {
  id: string
  empresaId: string
  sedeId: string | null
  nombre: string
  empresaNombre: string | null
  documento: string | null
  email: string | null
  telefono: string | null
  celular: string | null
  ciudad: string | null
  ownerUserId: string | null
  createdById: string
  sourceKey: string | null
  sourceLabel: string | null
  lastActivityAt: Date | null
  createdAt: Date
}

type ContactRef = { id: string; emailNormalized: string | null }

type ResolvedContact = {
  contact: ContactRef
  created: boolean
  strategy: string | null
}

type Summary = {
  leadsScanned: number
  contactsCreated: number
  contactsReused: number
  leadsLinked: number
  capturesLinked: number
  conversationsLinked: number
  opportunitiesLinked: number
  activitiesLinked: number
  contactsTouched: number
}

const leadSelect = {
  id: true,
  empresaId: true,
  sedeId: true,
  nombre: true,
  empresaNombre: true,
  documento: true,
  email: true,
  telefono: true,
  celular: true,
  ciudad: true,
  ownerUserId: true,
  createdById: true,
  sourceKey: true,
  sourceLabel: true,
  lastActivityAt: true,
  createdAt: true,
} as const

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, batchSize: 200 }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (token === '--empresa') {
      args.empresaId = argv[i + 1]
      i++
      continue
    }
    if (token === '--batch') {
      const value = Number(argv[i + 1])
      if (Number.isFinite(value) && value > 0) args.batchSize = Math.floor(value)
      i++
      continue
    }
    if (token === '--limit') {
      const value = Number(argv[i + 1])
      if (Number.isFinite(value) && value > 0) args.limit = Math.floor(value)
      i++
      continue
    }
  }

  if (!args.empresaId && process.env.EMPRESA_ID) args.empresaId = process.env.EMPRESA_ID
  return args
}

function resolveLeadPhone(lead: Pick<LeadRow, 'celular' | 'telefono'>): string | null {
  return normalizeContactPhoneDigits(lead.celular) ?? normalizeContactPhoneDigits(lead.telefono)
}

/**
 * Resuelve el contacto canónico del lead con el motor compartido
 * (`crm-contact-identity`). Si no lo encuentra, lo crea con el mismo contrato
 * que usa la ingesta, de modo que el backfill y el runtime no divergen.
 */
async function resolveContactForLead(client: PrismaClient, lead: LeadRow, dryRun: boolean): Promise<ResolvedContact> {
  const phone = resolveLeadPhone(lead)

  const found = await findContactBySignals({
    client,
    empresaId: lead.empresaId,
    documento: lead.documento,
    email: lead.email,
    phone,
  })

  if (found) {
    return {
      contact: { id: found.contact.id, emailNormalized: found.contact.emailNormalized },
      created: false,
      strategy: found.trace.strategy,
    }
  }

  // En --dry-run no se crea nada: solo se informa que el contacto faltaría.
  if (dryRun) {
    return {
      contact: { id: `dry-run:${lead.id}`, emailNormalized: null },
      created: true,
      strategy: null,
    }
  }

  const ensured = await ensureContactIdentity({
    client,
    empresaId: lead.empresaId,
    sedeId: lead.sedeId,
    createdById: lead.createdById,
    ownerUserId: lead.ownerUserId,
    identity: {
      nombre: lead.nombre,
      empresaNombre: lead.empresaNombre,
      documento: lead.documento,
      email: lead.email,
      phone,
      ciudad: lead.ciudad,
    },
    sourceKey: lead.sourceKey,
    sourceLabel: lead.sourceLabel,
    lastInteractionAt: lead.lastActivityAt ?? lead.createdAt,
    note: `Contacto creado por backfill M5 desde el lead ${lead.id}`,
  })

  return {
    contact: { id: ensured.contact.id, emailNormalized: ensured.contact.emailNormalized },
    created: ensured.created,
    strategy: ensured.trace?.strategy ?? null,
  }
}

async function linkLead(client: PrismaClient, lead: LeadRow, contact: ContactRef, summary: Summary) {
  await client.crmLead.update({ where: { id: lead.id }, data: { contactId: contact.id } })
  summary.leadsLinked++

  const propagated = await propagateContactToLeadChildren(client, lead.id, contact.id)
  summary.capturesLinked += propagated.captures
  summary.conversationsLinked += propagated.conversations
  summary.opportunitiesLinked += propagated.opportunities
  summary.activitiesLinked += propagated.activities

  const lastInteraction = lead.lastActivityAt ?? lead.createdAt
  const touched = await touchContactInteraction(client, contact.id, lastInteraction)
  if (touched) summary.contactsTouched++
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno (.env)')
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const summary: Summary = {
    leadsScanned: 0,
    contactsCreated: 0,
    contactsReused: 0,
    leadsLinked: 0,
    capturesLinked: 0,
    conversationsLinked: 0,
    opportunitiesLinked: 0,
    activitiesLinked: 0,
    contactsTouched: 0,
  }

  console.log(
    `Backfill M5 · contactos CRM · dryRun=${args.dryRun} · empresa=${args.empresaId ?? 'todas'} · batch=${args.batchSize}`,
  )

  try {
    // Fase A: leads sin contacto → resolver o crear contacto canónico
    let cursor: string | undefined
    let processed = 0

    while (true) {
      const remaining = typeof args.limit === 'number' ? args.limit - processed : args.batchSize
      const take = Math.min(args.batchSize, remaining)
      if (take <= 0) break

      const leads = await prisma.crmLead.findMany({
        where: {
          contactId: null,
          ...(args.empresaId ? { empresaId: args.empresaId } : {}),
        },
        orderBy: { id: 'asc' },
        take,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: leadSelect,
      })

      if (leads.length === 0) break
      cursor = leads[leads.length - 1]?.id
      processed += leads.length
      summary.leadsScanned += leads.length

      for (const lead of leads) {
        const resolved = await resolveContactForLead(prisma, lead, args.dryRun)

        if (resolved.created) summary.contactsCreated++
        else summary.contactsReused++

        if (args.dryRun) continue
        await linkLead(prisma, lead, resolved.contact, summary)
      }

      if (typeof args.limit === 'number' && processed >= args.limit) break
    }

    // Fase B: leads que ya tienen contacto pero con hijos sin contactId
    let cursorB: string | undefined
    let processedB = 0

    while (true) {
      const remaining = typeof args.limit === 'number' ? args.limit - processedB : args.batchSize
      const take = Math.min(args.batchSize, remaining)
      if (take <= 0) break

      const leads = await prisma.crmLead.findMany({
        where: {
          contactId: { not: null },
          // Nunca propagamos hacia contactos fusionados (M4).
          contact: { is: { mergedIntoId: null } },
          ...(args.empresaId ? { empresaId: args.empresaId } : {}),
          OR: [
            { captures: { some: { contactId: null } } },
            { conversations: { some: { contactId: null } } },
            { opportunities: { some: { contactId: null } } },
            { activities: { some: { contactId: null } } },
          ],
        },
        orderBy: { id: 'asc' },
        take,
        ...(cursorB ? { cursor: { id: cursorB }, skip: 1 } : {}),
        select: { id: true, contactId: true },
      })

      if (leads.length === 0) break
      cursorB = leads[leads.length - 1]?.id
      processedB += leads.length

      for (const lead of leads) {
        if (!lead.contactId) continue
        if (args.dryRun) continue
        const propagated = await propagateContactToLeadChildren(prisma, lead.id, lead.contactId)
        summary.capturesLinked += propagated.captures
        summary.conversationsLinked += propagated.conversations
        summary.opportunitiesLinked += propagated.opportunities
        summary.activitiesLinked += propagated.activities
      }

      if (typeof args.limit === 'number' && processedB >= args.limit) break
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }

  console.log('Resumen del backfill M5:')
  console.log(JSON.stringify(summary, null, 2))
  if (args.dryRun) {
    console.log('Modo --dry-run: no se escribió ningún dato. Ejecuta sin --dry-run para aplicar.')
  }
}

main().catch((error) => {
  console.error('Backfill M5 falló:', error)
  process.exitCode = 1
})

