/**
 * Cliente de Prisma - Singleton para evitar múltiples instancias
 * 
 * En desarrollo, Next.js hace hot-reload y crearía múltiples instancias
 * de PrismaClient. Esta configuración evita ese problema.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

if (!globalForPrisma.pool) {
  globalForPrisma.pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  })
}

const adapter = new PrismaPg(globalForPrisma.pool)

function runtimeModelHasField(client: PrismaClient, modelName: string, fieldName: string): boolean {
  try {
    const runtimeDataModel = (client as unknown as { _runtimeDataModel?: any })._runtimeDataModel
    const model = runtimeDataModel?.models?.[modelName]
    const fields: Array<{ name: string }> | undefined = model?.fields
    return Array.isArray(fields) ? fields.some((f) => f?.name === fieldName) : false
  } catch {
    return false
  }
}

let prismaClient = globalForPrisma.prisma

// En desarrollo, el singleton puede quedar desfasado si se regeneró Prisma Client
// mientras el server estaba corriendo (HMR + cache global). Si detectamos que le
// faltan campos nuevos, forzamos una nueva instancia.
if (process.env.NODE_ENV !== 'production' && prismaClient) {
  const hasTrialTier = runtimeModelHasField(prismaClient, 'Empresa', 'trialTier')
  const hasWorkspaceCode = runtimeModelHasField(prismaClient, 'Empresa', 'workspaceCode')
  const hasPlanOwnerUserId = runtimeModelHasField(prismaClient, 'Empresa', 'planOwnerUserId')

  const hasNotificationArchivedAt = runtimeModelHasField(prismaClient, 'Notification', 'archivedAt')
  const hasNotificationPublishAt = runtimeModelHasField(prismaClient, 'Notification', 'publishAt')
  const hasMaterialRequiresWorkOrder = runtimeModelHasField(prismaClient, 'Material', 'requiresWorkOrder')
  const hasPosInvoiceCotizacionId = runtimeModelHasField(prismaClient, 'PosInvoice', 'cotizacionId')
  const hasOrdenTrabajoSourceType = runtimeModelHasField(prismaClient, 'OrdenTrabajo', 'sourceType')
  const hasMaterialTipoNombre = runtimeModelHasField(prismaClient, 'Material', 'tipoNombre')
  const hasMaterialExtraFields = runtimeModelHasField(prismaClient, 'Material', 'extraFields')

  const hasWorkspaceAccessRequestDelegate =
    typeof (prismaClient as any)?.workspaceAccessRequest?.findMany === 'function'

  const hasHelpVideoDelegate = typeof (prismaClient as any)?.helpVideo?.findMany === 'function'

  const hasEmpresaTemplateDelegate = typeof (prismaClient as any)?.empresaCotizacionTemplate?.findUnique === 'function'
  const hasEmpresaTemplateVersionDelegate =
    typeof (prismaClient as any)?.empresaCotizacionTemplateVersion?.findMany === 'function'
  const hasCotizacionTemplateVersionDelegate = typeof (prismaClient as any)?.cotizacionTemplateVersion?.findMany === 'function'
  const hasOrdenCompraTemplateDelegate = typeof (prismaClient as any)?.ordenCompraTemplate?.findUnique === 'function'
  const hasPosInvoiceTemplateDelegate = typeof (prismaClient as any)?.posInvoiceTemplate?.findUnique === 'function'
  const hasCrmLeadDelegate = typeof (prismaClient as any)?.crmLead?.findMany === 'function'
  const hasCrmOpportunityDelegate = typeof (prismaClient as any)?.crmOpportunity?.findMany === 'function'
  const hasCrmStageSettingDelegate = typeof (prismaClient as any)?.crmStageSetting?.findMany === 'function'
  const hasCrmContactDelegate = typeof (prismaClient as any)?.crmContact?.findMany === 'function'
  const hasCrmActivityDelegate = typeof (prismaClient as any)?.crmActivity?.findMany === 'function'
  const hasCrmTaskDelegate = typeof (prismaClient as any)?.crmTask?.findMany === 'function'
  const hasCrmTaskWorkspaceDelegate = typeof (prismaClient as any)?.crmTaskWorkspace?.findMany === 'function'
  const hasCrmTaskWorkspaceMemberDelegate = typeof (prismaClient as any)?.crmTaskWorkspaceMember?.findMany === 'function'
  const hasCrmTaskAssignmentDelegate = typeof (prismaClient as any)?.crmTaskAssignment?.findMany === 'function'
  const hasCrmTaskHistoryDelegate = typeof (prismaClient as any)?.crmTaskHistory?.findMany === 'function'
  const hasCrmChannelConnectionDelegate = typeof (prismaClient as any)?.crmChannelConnection?.findMany === 'function'
  const hasCrmConversationDelegate = typeof (prismaClient as any)?.crmConversation?.findMany === 'function'
  const hasCrmMessageDelegate = typeof (prismaClient as any)?.crmMessage?.findMany === 'function'
  const hasCrmLeadCaptureDelegate = typeof (prismaClient as any)?.crmLeadCapture?.findMany === 'function'
  const hasLitografiaPaperRequestDelegate = typeof (prismaClient as any)?.litografiaPaperRequest?.findMany === 'function'
  const hasInternalChatThreadDelegate = typeof (prismaClient as any)?.internalChatThread?.findMany === 'function'
  const hasInternalChatParticipantDelegate = typeof (prismaClient as any)?.internalChatParticipant?.findMany === 'function'
  const hasInternalChatMessageDelegate = typeof (prismaClient as any)?.internalChatMessage?.findMany === 'function'
  const hasProductTypeOptionDelegate = typeof (prismaClient as any)?.productTypeOption?.findMany === 'function'
  const hasProductCategoryOptionDelegate = typeof (prismaClient as any)?.productCategoryOption?.findMany === 'function'
  const hasProductCustomFieldDefinitionDelegate = typeof (prismaClient as any)?.productCustomFieldDefinition?.findMany === 'function'

  if (
    !hasTrialTier ||
    !hasWorkspaceCode ||
    !hasPlanOwnerUserId ||
    !hasNotificationArchivedAt ||
    !hasNotificationPublishAt ||
    !hasMaterialRequiresWorkOrder ||
    !hasPosInvoiceCotizacionId ||
    !hasOrdenTrabajoSourceType ||
    !hasMaterialTipoNombre ||
    !hasMaterialExtraFields ||
    !hasWorkspaceAccessRequestDelegate ||
    !hasHelpVideoDelegate ||
    !hasEmpresaTemplateDelegate ||
    !hasEmpresaTemplateVersionDelegate ||
    !hasCotizacionTemplateVersionDelegate ||
    !hasOrdenCompraTemplateDelegate ||
    !hasPosInvoiceTemplateDelegate ||
    !hasCrmLeadDelegate ||
    !hasCrmOpportunityDelegate ||
    !hasCrmStageSettingDelegate ||
    !hasCrmContactDelegate ||
    !hasCrmActivityDelegate ||
    !hasCrmTaskDelegate ||
    !hasCrmTaskWorkspaceDelegate ||
    !hasCrmTaskWorkspaceMemberDelegate ||
    !hasCrmTaskAssignmentDelegate ||
    !hasCrmTaskHistoryDelegate ||
    !hasCrmChannelConnectionDelegate ||
    !hasCrmConversationDelegate ||
    !hasCrmMessageDelegate ||
    !hasCrmLeadCaptureDelegate ||
    !hasLitografiaPaperRequestDelegate ||
    !hasInternalChatThreadDelegate ||
    !hasInternalChatParticipantDelegate ||
    !hasInternalChatMessageDelegate ||
    !hasProductTypeOptionDelegate ||
    !hasProductCategoryOptionDelegate ||
    !hasProductCustomFieldDefinitionDelegate
  ) {
    prismaClient = undefined
  }
}

export const prisma =
  prismaClient ??
  (new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as PrismaClient)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
