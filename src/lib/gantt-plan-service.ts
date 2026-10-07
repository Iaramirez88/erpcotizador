import { prisma } from '@/lib/prisma'

export const ganttPlanInclude = {
  workspace: { select: { id: true, name: true } },
  project: { select: { id: true, workspaceId: true, name: true } },
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  },
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      linkedTask: { select: { id: true, title: true } },
      assignments: {
        orderBy: { createdAt: 'asc' as const },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
      comments: {
        orderBy: { createdAt: 'asc' as const },
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
      },
      reads: { select: { userId: true, lastReadAt: true } },
      predecessorLinks: true,
      successorLinks: true,
    },
  },
}

export type GanttPlanDraftItem = {
  title: string
  description?: string | null
  colorHex: string
  offsetDays: number
  durationDays: number
  parentIndex?: number | null
  isMilestone?: boolean
}

export type GanttPlanDraftDependency = {
  predecessorIndex: number
  successorIndex: number
  lagDays?: number
}

function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export async function createGanttPlanFromDraft(args: {
  empresaId: string
  createdById: string
  name: string
  description?: string | null
  colorHex: string
  workspaceId?: string | null
  projectId?: string | null
  startDate: Date
  items: GanttPlanDraftItem[]
  dependencies?: GanttPlanDraftDependency[]
}) {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.crmGanttPlan.create({
      data: {
        empresaId: args.empresaId,
        createdById: args.createdById,
        name: args.name,
        description: args.description || null,
        colorHex: args.colorHex,
        workspaceId: args.workspaceId || null,
        projectId: args.projectId || null,
      },
      select: { id: true },
    })

    const itemIds: string[] = []
    for (const [index, item] of args.items.entries()) {
      const parentItemId = item.parentIndex == null ? null : itemIds[item.parentIndex] || null
      const startAt = addDays(args.startDate, item.offsetDays)
      const dueAt = item.isMilestone
        ? startAt
        : addDays(startAt, Math.max(0, item.durationDays - 1))
      const created = await tx.crmGanttItem.create({
        data: {
          planId: plan.id,
          parentItemId,
          title: item.title,
          description: item.description || null,
          colorHex: item.colorHex,
          startAt,
          dueAt,
          isMilestone: Boolean(item.isMilestone),
          sortOrder: index,
        },
        select: { id: true },
      })
      itemIds.push(created.id)
    }

    const validDependencies = (args.dependencies || []).filter(
      (dependency) =>
        dependency.predecessorIndex !== dependency.successorIndex &&
        itemIds[dependency.predecessorIndex] &&
        itemIds[dependency.successorIndex],
    )
    if (validDependencies.length) {
      await tx.crmGanttDependency.createMany({
        data: validDependencies.map((dependency) => ({
          predecessorItemId: itemIds[dependency.predecessorIndex],
          successorItemId: itemIds[dependency.successorIndex],
          lagDays: Math.max(0, Math.round(dependency.lagDays || 0)),
        })),
        skipDuplicates: true,
      })
    }

    return tx.crmGanttPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: ganttPlanInclude,
    })
  })
}
