/**
 * Cliente de Prisma - Singleton para evitar múltiples instancias
 * 
 * En desarrollo, Next.js hace hot-reload y crearía múltiples instancias
 * de PrismaClient. Esta configuración evita ese problema.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { deliverNotifications } from '@/lib/notification-delivery'

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
  const hasCrmTaskWorkspaceProjectDelegate = typeof (prismaClient as any)?.crmTaskWorkspaceProject?.findMany === 'function'
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
  const hasWebsiteServiceDelegate = typeof (prismaClient as any)?.websiteService?.findMany === 'function'
  const hasWebsiteServiceModuleAccessDelegate = typeof (prismaClient as any)?.websiteServiceModuleAccess?.findMany === 'function'
  const hasWebsiteServiceReminderSettingDelegate = typeof (prismaClient as any)?.websiteServiceReminderSetting?.findUnique === 'function'
  const hasWebsiteServiceReminderLogDelegate = typeof (prismaClient as any)?.websiteServiceReminderLog?.findMany === 'function'
  const hasWebsiteServiceMessageTemplateDelegate = typeof (prismaClient as any)?.websiteServiceMessageTemplate?.findMany === 'function'
  const hasPlanCatalogSettingDelegate = typeof (prismaClient as any)?.planCatalogSetting?.findMany === 'function'
  const hasPayrollEmployeeDelegate = typeof (prismaClient as any)?.payrollEmployee?.findMany === 'function'
  const hasPayrollContractDelegate = typeof (prismaClient as any)?.payrollContract?.findMany === 'function'
  const hasPayrollPeriodDelegate = typeof (prismaClient as any)?.payrollPeriod?.findMany === 'function'
  const hasPayrollNoveltyDelegate = typeof (prismaClient as any)?.payrollNovelty?.findMany === 'function'
  const hasPayrollSettlementDelegate = typeof (prismaClient as any)?.payrollSettlement?.findMany === 'function'
  const hasPayrollPayslipDelegate = typeof (prismaClient as any)?.payrollPayslip?.findMany === 'function'
  const hasPayrollEmployeeDocumentDelegate = typeof (prismaClient as any)?.payrollEmployeeDocument?.findMany === 'function'
  const hasPayrollOnboardingJourneyDelegate = typeof (prismaClient as any)?.payrollOnboardingJourney?.findMany === 'function'
  const hasPayrollEmployeeServiceCaseDelegate = typeof (prismaClient as any)?.payrollEmployeeServiceCase?.findMany === 'function'
  const hasPayrollWhistleblowerCaseDelegate = typeof (prismaClient as any)?.payrollWhistleblowerCase?.findMany === 'function'
  const hasPayrollRecruitmentCandidateDelegate = typeof (prismaClient as any)?.payrollRecruitmentCandidate?.findMany === 'function'
  const hasPayrollSurveyCampaignDelegate = typeof (prismaClient as any)?.payrollSurveyCampaign?.findMany === 'function'
  const hasPayrollPerformanceReviewDelegate = typeof (prismaClient as any)?.payrollPerformanceReview?.findMany === 'function'
  const hasPayrollTrainingAssignmentDelegate = typeof (prismaClient as any)?.payrollTrainingAssignment?.findMany === 'function'
  const hasPayrollAttendanceEntryDelegate = typeof (prismaClient as any)?.payrollAttendanceEntry?.findMany === 'function'
  const hasPayrollBenefitRequestDelegate = typeof (prismaClient as any)?.payrollBenefitRequest?.findMany === 'function'
  const hasPayrollBenefitOfferingDelegate = typeof (prismaClient as any)?.payrollBenefitOffering?.findMany === 'function'
  const hasPayrollOrgUnitDelegate = typeof (prismaClient as any)?.payrollOrgUnit?.findMany === 'function'
  const hasPayrollPortalHighlightDelegate = typeof (prismaClient as any)?.payrollPortalHighlight?.findMany === 'function'
  const hasPayrollAccessProfileDelegate = typeof (prismaClient as any)?.payrollAccessProfile?.findMany === 'function'
  const hasPayrollWorkflowTemplateDelegate = typeof (prismaClient as any)?.payrollWorkflowTemplate?.findMany === 'function'
  const hasPayrollPeopleReportDelegate = typeof (prismaClient as any)?.payrollPeopleReport?.findMany === 'function'
  const hasAccountingPeriodDelegate = typeof (prismaClient as any)?.accountingPeriod?.findMany === 'function'
  const hasAccountingVoucherDelegate = typeof (prismaClient as any)?.accountingVoucher?.findMany === 'function'
  const hasAccountingVoucherLineDelegate = typeof (prismaClient as any)?.accountingVoucherLine?.findMany === 'function'
  const hasDecisionEngineSnapshotDelegate = typeof (prismaClient as any)?.decisionEngineSnapshot?.findMany === 'function'
  const hasDotacionPedidoDelegate = typeof (prismaClient as any)?.dotacionPedido?.findMany === 'function'
  const hasDotacionPedidoItemDelegate = typeof (prismaClient as any)?.dotacionPedidoItem?.findMany === 'function'
  const hasRestauranteTurnoDelegate = typeof (prismaClient as any)?.restauranteTurno?.findMany === 'function'
  const hasWebPushSubscriptionDelegate = typeof (prismaClient as any)?.webPushSubscription?.findMany === 'function'

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
    !hasCrmTaskWorkspaceProjectDelegate ||
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
    !hasProductCustomFieldDefinitionDelegate ||
    !hasWebsiteServiceDelegate ||
    !hasWebsiteServiceModuleAccessDelegate ||
    !hasWebsiteServiceReminderSettingDelegate ||
    !hasWebsiteServiceReminderLogDelegate ||
    !hasWebsiteServiceMessageTemplateDelegate ||
    !hasPlanCatalogSettingDelegate ||
    !hasPayrollEmployeeDelegate ||
    !hasPayrollContractDelegate ||
    !hasPayrollPeriodDelegate ||
    !hasPayrollNoveltyDelegate ||
    !hasPayrollSettlementDelegate ||
    !hasPayrollPayslipDelegate ||
    !hasPayrollEmployeeDocumentDelegate ||
    !hasPayrollOnboardingJourneyDelegate ||
    !hasPayrollEmployeeServiceCaseDelegate ||
    !hasPayrollWhistleblowerCaseDelegate ||
    !hasPayrollRecruitmentCandidateDelegate ||
    !hasPayrollSurveyCampaignDelegate ||
    !hasPayrollPerformanceReviewDelegate ||
    !hasPayrollTrainingAssignmentDelegate ||
    !hasPayrollAttendanceEntryDelegate ||
    !hasPayrollBenefitRequestDelegate ||
    !hasPayrollBenefitOfferingDelegate ||
    !hasPayrollOrgUnitDelegate ||
    !hasPayrollPortalHighlightDelegate ||
    !hasPayrollAccessProfileDelegate ||
    !hasPayrollWorkflowTemplateDelegate ||
    !hasPayrollPeopleReportDelegate ||
    !hasAccountingPeriodDelegate ||
    !hasAccountingVoucherDelegate ||
    !hasAccountingVoucherLineDelegate ||
    !hasDecisionEngineSnapshotDelegate ||
    !hasDotacionPedidoDelegate ||
    !hasDotacionPedidoItemDelegate ||
    !hasRestauranteTurnoDelegate ||
    !hasWebPushSubscriptionDelegate
  ) {
    prismaClient = undefined
  }
}

const prismaBase =
  prismaClient ??
  (new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }) as PrismaClient)

const prismaExtended = prismaBase.$extends({
  query: {
    notification: {
      async create({ args, query }) {
        const created = await query(args)
        const createdNotification = created as {
          id: string
          type: string
          title: string
          body: string | null
          actionUrl: string | null
          actionLabel: string | null
          readAt: Date | null
          createdAt: Date
          userId: string | null
        }

        void deliverNotifications(prismaBase, {
          id: createdNotification.id,
          type: createdNotification.type,
          title: createdNotification.title,
          body: createdNotification.body,
          actionUrl: createdNotification.actionUrl,
          actionLabel: createdNotification.actionLabel,
          readAt: createdNotification.readAt,
          createdAt: createdNotification.createdAt,
          userId: createdNotification.userId,
        })

        return created
      },
      async createMany({ args, query }) {
        const result = await query(args)

        const items = (Array.isArray(args.data) ? args.data : [args.data]) as Array<{
          id?: string | null
          type?: string | null
          title?: string | null
          body?: string | null
          actionUrl?: string | null
          actionLabel?: string | null
          readAt?: Date | null
          createdAt?: Date | null
          userId?: string | null
        }>
        void deliverNotifications(prismaBase, items)

        return result
      },
    },
  },
})

export const prisma = prismaExtended as unknown as PrismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaBase
