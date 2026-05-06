import { AccessLevel, Prisma, ModuleKey } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { fetchGoogleSheetsRows, getGoogleSheetsSettings, type GoogleSheetsNormalizedRow } from '@/lib/crm-google-sheets'
import { createInboundArtifacts, parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function clampLimit(value: unknown, fallback: number) {
  const parsed = Number.parseInt(normalizeString(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, fallback)
}

function buildRowMessage(row: GoogleSheetsNormalizedRow) {
  const chunks = [
    row.mensaje,
    row.producto ? `Producto/servicio: ${row.producto}` : '',
    row.empresaNombre ? `Empresa: ${row.empresaNombre}` : '',
  ].filter(Boolean)
  return chunks.join(' | ')
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      include: { createdBy: { select: { id: true } } },
    })

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const settings = parseJsonObject(channel.settingsJson)
    if (channel.provider !== 'WEB_FORM' || normalizeString(settings.bridgeKind).toUpperCase() !== 'GOOGLE_SHEETS') {
      return NextResponse.json({ error: 'El canal no está configurado como Google Sheets Bridge' }, { status: 409 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const normalizedSettings = getGoogleSheetsSettings(settings)
    const sheet = await fetchGoogleSheetsRows(settings)
    const limit = clampLimit(body?.limit, normalizedSettings.rowLimit)
    const sourceRows = sheet.rows.slice(0, limit)

    const result = await prisma.$transaction(async (tx) => {
      const summary = {
        imported: 0,
        skipped: 0,
        opportunitiesCreated: 0,
        items: [] as Array<{ rowNumber: number; leadId?: string; conversationId?: string; opportunityId?: string; status: 'imported' | 'skipped' }>,
      }

      for (const row of sourceRows) {
        if (!row.nombre && !row.email && !row.telefono) {
          summary.skipped += 1
          summary.items.push({ rowNumber: row.rowNumber, status: 'skipped' })
          continue
        }

        const rowKey = `gs:${channel.id}:${normalizedSettings.sheetName || 'sheet'}:${row.rowNumber}`
        const messageText = buildRowMessage(row)
        const artifacts = await createInboundArtifacts({
          client: tx,
          empresaId: access.empresaId,
          sedeId: channel.sedeId,
          createdById: access.userId,
          ownerUserId: access.userId,
          channelConnectionId: channel.id,
          source: 'IMPORT',
          captureType: 'MANUAL_IMPORT',
          activityType: 'NOTE',
          messageType: 'TEXT',
          nombre: row.nombre,
          empresaNombre: row.empresaNombre,
          email: row.email,
          phone: row.telefono,
          document: row.documento,
          ciudad: row.ciudad,
          messageText,
          externalThreadId: rowKey,
          providerMessageId: rowKey,
          providerLeadId: rowKey,
          sourceLabel: 'Google Sheets Bridge',
          sourceCampaign: row.sourceCampaign || channel.name,
          sourceMedium: row.sourceMedium || 'google-sheets',
          sourceContent: row.sourceContent || row.producto || null,
          utmSource: row.utmSource || 'google-sheets',
          utmMedium: row.utmMedium || 'sheet-import',
          utmCampaign: row.utmCampaign || row.sourceCampaign || null,
          utmContent: row.utmContent || null,
          utmTerm: row.utmTerm || null,
          landingPageUrl: row.landingPageUrl || sheet.csvUrl,
          referrerUrl: sheet.csvUrl,
          rawPayloadJson: row.raw as Prisma.InputJsonValue,
          normalizedDataJson: {
            source: 'GOOGLE_SHEETS',
            spreadsheetId: normalizedSettings.spreadsheetId || null,
            sheetName: normalizedSettings.sheetName || null,
            csvUrl: sheet.csvUrl,
            rowNumber: row.rowNumber,
            importMode: normalizedSettings.importMode,
            row,
          } as Prisma.InputJsonValue,
        })

        let opportunityId: string | undefined
        if (normalizedSettings.importMode === 'LEADS_AND_OPPORTUNITIES' && (row.opportunityTitle || row.expectedValue !== null || row.producto)) {
          const title = row.opportunityTitle || (row.producto ? `Oportunidad · ${row.producto}` : `Oportunidad · fila ${row.rowNumber}`)
          const existing = await tx.crmOpportunity.findFirst({
            where: {
              empresaId: access.empresaId,
              leadId: artifacts.lead.id,
              title,
              stage: { notIn: ['WON', 'LOST'] },
            },
            select: { id: true },
          })

          if (!existing) {
            const createdOpportunity = await tx.crmOpportunity.create({
              data: {
                empresaId: access.empresaId,
                sedeId: channel.sedeId,
                title,
                description: messageText || null,
                stage: normalizedSettings.opportunityStage,
                leadId: artifacts.lead.id,
                expectedValue: row.expectedValue ?? 0,
                probabilityPct: row.probabilityPct ?? 0,
                expectedCloseAt: row.expectedCloseAt,
                createdById: access.userId,
              },
              select: { id: true },
            })
            opportunityId = createdOpportunity.id
            summary.opportunitiesCreated += 1

            if (!artifacts.conversation.opportunityId) {
              await tx.crmConversation.update({
                where: { id: artifacts.conversation.id },
                data: { opportunityId: createdOpportunity.id },
              })
            }
          } else {
            opportunityId = existing.id
          }
        }

        summary.imported += 1
        summary.items.push({
          rowNumber: row.rowNumber,
          leadId: artifacts.lead.id,
          conversationId: artifacts.conversation.id,
          opportunityId,
          status: 'imported',
        })
      }

      return summary
    })

    return NextResponse.json({
      success: true,
      data: {
        channelId: channel.id,
        channelName: channel.name,
        importedRows: result.imported,
        skippedRows: result.skipped,
        opportunitiesCreated: result.opportunitiesCreated,
        processedRows: sourceRows.length,
        csvUrl: sheet.csvUrl,
        items: result.items,
      },
    })
  } catch (error) {
    console.error('Error importando Google Sheets CRM:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error importando Google Sheets' }, { status: 500 })
  }
}
