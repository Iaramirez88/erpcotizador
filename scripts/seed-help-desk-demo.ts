import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import type { HelpTicketPriority, HelpTicketStatus, HelpTicketType, Prisma } from '@prisma/client'

const DEMO_TAG = 'HELP_DESK_DEMO_V1'

type DemoTicket = {
  subject: string
  description: string
  category: string
  module: string
  priority: HelpTicketPriority
  status: HelpTicketStatus
  type: HelpTicketType
  messages: Array<{ visibility: 'PUBLIC' | 'INTERNAL'; bodyText: string }>
}

const DEMO_TICKETS: DemoTicket[] = [
  {
    subject: 'No permite ajustar cantidades de inventario',
    description: 'Al intentar registrar un ajuste de inventario, el sistema mantiene la cantidad anterior. Se requiere validar permisos y el flujo de movimientos.',
    category: 'Incidente funcional',
    module: 'Inventario',
    priority: 'HIGH',
    status: 'NEW',
    type: 'INCIDENT',
    messages: [],
  },
  {
    subject: 'Validar impresión de factura POS',
    description: 'La factura se genera correctamente, pero necesitamos confirmar que el formato de impresión muestre el medio de pago y los datos del cliente.',
    category: 'Soporte técnico',
    module: 'Facturación POS',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    type: 'TECHNICAL_SUPPORT',
    messages: [
      { visibility: 'PUBLIC', bodyText: 'Recibimos la solicitud. Estamos revisando la plantilla de impresión y la configuración del punto de venta.' },
      { visibility: 'INTERNAL', bodyText: 'Verificar primero la plantilla activa y reproducir con una venta de prueba sin afectar consecutivos.' },
    ],
  },
  {
    subject: 'Usuarios del CRM no ven las oportunidades asignadas',
    description: 'Dos usuarios comerciales indican que no pueden consultar oportunidades que fueron asignadas a su equipo. Se requiere revisar alcance de permisos.',
    category: 'Permisos y acceso',
    module: 'CRM',
    priority: 'CRITICAL',
    status: 'WAITING_CUSTOMER',
    type: 'INCIDENT',
    messages: [
      { visibility: 'PUBLIC', bodyText: 'Estamos validando los permisos del equipo. Por favor confirma los correos de los usuarios afectados y una oportunidad de ejemplo.' },
    ],
  },
]

function parseEmailArg() {
  const argument = process.argv.find((item) => item.startsWith('--email='))
  return argument?.slice('--email='.length).trim() || ''
}

async function resolveTargetUser() {
  const email = parseEmailArg()
  const user = email
    ? await prisma.user.findUnique({ where: { email }, include: { sedeMemberships: { orderBy: { createdAt: 'asc' }, take: 1 } } })
    : await prisma.user.findFirst({
        where: { empresaId: { not: null }, sedeMemberships: { some: {} } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: { sedeMemberships: { orderBy: { createdAt: 'asc' }, take: 1 } },
      })

  const membership = user?.sedeMemberships[0]
  if (!user?.empresaId || !membership) throw new Error('No se encontró un usuario con empresa y sede para crear los tickets demo.')
  return { user, sedeId: membership.sedeId, empresaId: user.empresaId }
}

async function nextTicketNumber(tx: Prisma.TransactionClient, sedeId: string, year: number) {
  const sequence = await tx.helpTicketSequence.upsert({
    where: { sedeId_year: { sedeId, year } },
    create: { sedeId, year, currentNumber: 1 },
    update: { currentNumber: { increment: 1 } },
    select: { currentNumber: true },
  })
  return `TKT-${year}-${String(sequence.currentNumber).padStart(6, '0')}`
}

async function main() {
  const { user, sedeId, empresaId } = await resolveTargetUser()
  const year = new Date().getFullYear()
  let created = 0

  for (const demo of DEMO_TICKETS) {
    const existing = await prisma.helpTicket.findFirst({ where: { empresaId, sedeId, subject: demo.subject }, select: { number: true } })
    if (existing) {
      console.log(`Ya existe ${existing.number}: ${demo.subject}`)
      continue
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const number = await nextTicketNumber(tx, sedeId, year)
      const now = new Date()
      const createdTicket = await tx.helpTicket.create({
        data: {
          number,
          empresaId,
          sedeId,
          requesterId: user.id,
          assignedToId: demo.status === 'NEW' ? null : user.id,
          assignedAt: demo.status === 'NEW' ? null : now,
          startedAt: ['IN_PROGRESS', 'WAITING_CUSTOMER'].includes(demo.status) ? now : null,
          firstResponseAt: demo.messages.some((message) => message.visibility === 'PUBLIC') ? now : null,
          waitingSince: demo.status === 'WAITING_CUSTOMER' ? now : null,
          subject: demo.subject,
          description: demo.description,
          category: demo.category,
          module: demo.module,
          priority: demo.priority,
          status: demo.status,
          type: demo.type,
          channel: 'ADMIN',
        },
      })

      await tx.helpTicketActivity.createMany({
        data: [
          { empresaId, ticketId: createdTicket.id, actorId: user.id, type: 'CREATED', summary: 'Ticket creado', metadata: { demoTag: DEMO_TAG } },
          ...(demo.status === 'NEW' ? [] : [{ empresaId, ticketId: createdTicket.id, actorId: user.id, type: 'ASSIGNED' as const, summary: `Asignado a ${user.name || user.email}`, metadata: { demoTag: DEMO_TAG } }]),
          ...(demo.status === 'NEW' ? [] : [{ empresaId, ticketId: createdTicket.id, actorId: user.id, type: 'STATUS_CHANGED' as const, summary: `Estado actualizado a ${demo.status}`, metadata: { demoTag: DEMO_TAG, to: demo.status } }]),
        ],
      })

      for (const message of demo.messages) {
        const createdMessage = await tx.helpTicketMessage.create({ data: { empresaId, ticketId: createdTicket.id, authorId: user.id, visibility: message.visibility, bodyText: message.bodyText } })
        await tx.helpTicketActivity.create({ data: { empresaId, ticketId: createdTicket.id, actorId: user.id, type: message.visibility === 'INTERNAL' ? 'INTERNAL_NOTE_ADDED' : 'MESSAGE_ADDED', summary: message.visibility === 'INTERNAL' ? 'Nota interna agregada' : 'Respuesta pública agregada', metadata: { demoTag: DEMO_TAG, messageId: createdMessage.id } } })
      }

      return createdTicket
    })

    created += 1
    console.log(`Creado ${ticket.number}: ${ticket.subject}`)
  }

  console.log(`Tickets demo creados: ${created}. Usuario: ${user.name || user.email}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
