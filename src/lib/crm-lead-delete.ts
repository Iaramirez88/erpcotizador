import type { Prisma } from '@prisma/client'

type CrmDeleteClient = Prisma.TransactionClient

/**
 * Borra un lead y todo su rastro comercial de forma coordinada:
 *
 * - Oportunidades del pipeline.
 * - Tareas (agenda, calendario y seguimiento comercial), tanto las asociadas al
 *   lead como las asociadas a sus oportunidades.
 * - Actividades (lead y sus oportunidades).
 * - Conversaciones del lead y sus mensajes.
 * - Capturas de captación, eventos de puntuación y matriculaciones en secuencias.
 *
 * Los contactos (`CrmContact`) se conservan: son la entidad canónica compartida
 * y solo se desvinculan del lead.
 *
 * Devuelve la cantidad de leads eliminados.
 */
export async function deleteCrmLeadsCascade(
  client: CrmDeleteClient,
  args: { empresaId: string; leadIds: string[] }
): Promise<number> {
  const { empresaId } = args
  const leadIds = Array.from(new Set(args.leadIds.map((id) => id.trim()).filter(Boolean)))
  if (!leadIds.length) return 0

  const opportunities = await client.crmOpportunity.findMany({
    where: { leadId: { in: leadIds }, empresaId },
    select: { id: true },
  })
  const opportunityIds = opportunities.map((opportunity) => opportunity.id)

  const conversations = await client.crmConversation.findMany({
    where: { leadId: { in: leadIds }, empresaId },
    select: { id: true },
  })
  const conversationIds = conversations.map((conversation) => conversation.id)

  // Historial de puntuación (también tiene cascade desde el lead, pero se hace
  // explícito para mantener un único flujo predecible).
  await client.crmLeadScoreEvent.deleteMany({
    where: { leadId: { in: leadIds }, empresaId },
  })

  // Capturas de captación del lead (incluidas las de sus conversaciones).
  const captureWhere: Prisma.CrmLeadCaptureWhereInput = {
    empresaId,
    OR: [
      { leadId: { in: leadIds } },
      ...(conversationIds.length ? [{ conversationId: { in: conversationIds } }] : []),
    ],
  }
  await client.crmLeadCapture.deleteMany({ where: captureWhere })

  // Matriculaciones en secuencias de automatización vinculadas al lead.
  await client.crmSequenceEnrollment.deleteMany({
    where: { leadId: { in: leadIds }, empresaId },
  })

  // Conversaciones y sus mensajes (hilos de inbox del lead).
  if (conversationIds.length) {
    await client.crmMessage.deleteMany({
      where: { conversationId: { in: conversationIds }, empresaId },
    })
  }
  await client.crmConversation.deleteMany({
    where: { leadId: { in: leadIds }, empresaId },
  })

  // Actividades del lead y de sus oportunidades.
  const activityWhere: Prisma.CrmActivityWhereInput = {
    empresaId,
    OR: [
      { leadId: { in: leadIds } },
      ...(opportunityIds.length ? [{ opportunityId: { in: opportunityIds } }] : []),
    ],
  }
  await client.crmActivity.deleteMany({ where: activityWhere })

  // Tareas (agenda, calendario, seguimiento comercial) del lead y de sus
  // oportunidades. Se expande a las subtareas dependientes para no dejar
  // huérfanas. Sus dependencias/asignaciones/historial se borran en cascada.
  const taskWhere: Prisma.CrmTaskWhereInput = {
    empresaId,
    OR: [
      { leadId: { in: leadIds } },
      ...(opportunityIds.length ? [{ opportunityId: { in: opportunityIds } }] : []),
    ],
  }

  const directTasks = await client.crmTask.findMany({
    where: taskWhere,
    select: { id: true },
  })
  const taskIds = new Set(directTasks.map((task) => task.id))

  let frontier = Array.from(taskIds)
  for (let depth = 0; depth < 12 && frontier.length; depth += 1) {
    const children = await client.crmTask.findMany({
      where: { empresaId, parentTaskId: { in: frontier } },
      select: { id: true },
    })
    const newIds = children
      .filter((child) => !taskIds.has(child.id))
      .map((child) => child.id)
    if (!newIds.length) break
    newIds.forEach((id) => taskIds.add(id))
    frontier = newIds
  }

  if (taskIds.size) {
    await client.crmTask.deleteMany({
      where: { id: { in: Array.from(taskIds) }, empresaId },
    })
  }

  // Oportunidades del pipeline.
  await client.crmOpportunity.deleteMany({
    where: { leadId: { in: leadIds }, empresaId },
  })

  // Finalmente, el lead.
  const result = await client.crmLead.deleteMany({
    where: { id: { in: leadIds }, empresaId },
  })

  return result.count
}
