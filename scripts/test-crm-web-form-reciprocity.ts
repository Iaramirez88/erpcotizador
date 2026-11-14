/**
 * E2E del formulario de reciprocidad (WEB_FORM + finalidad INCENTIVE).
 *
 *   npm run test:crm-web-form-reciprocity
 *
 * Requiere el servidor de desarrollo arriba (`npm run dev`) porque envía el
 * formulario por HTTP contra `/api/crm/captures/web-form`.
 *
 * Crea datos temporales, envía el formulario y verifica lead, captura,
 * conversación, mensaje FORM_SUBMISSION, adjunto del PDF y enlace de descarga.
 * Limpia todo al final.
 */
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import { prisma } from '../src/lib/prisma'
import { loadRewardPdfAttachment } from '../src/lib/crm-reward-file'
import { buildPublicCrmFileRewardUrl } from '../src/lib/crm-public-file-link'
import { verifyCrmFileShareToken } from '../src/lib/share-token'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const MINIMAL_PDF = '%PDF-1.4\n%%EOF\n'

let failures = 0
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK  ' : 'FAIL'} · ${label}${detail !== undefined ? ` → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
}

async function main() {
  const stamp = Date.now()
  const empresa = await prisma.empresa.create({
    data: { nombre: `TMP RECIPROCITY ${stamp}`, nit: `TMP-REC-${stamp}`, planTier: 'BASIC' },
  })
  const user = await prisma.user.create({
    data: { email: `tmp-reciprocity-${stamp}@example.com`, name: 'TMP Reciprocity', empresaId: empresa.id },
  })
  const sede = await prisma.sede.create({ data: { nombre: 'TMP Sede', empresaId: empresa.id } })
  const fileDir = path.join(process.cwd(), 'public', 'uploads', 'crm-files', empresa.id)
  await fs.mkdir(fileDir, { recursive: true })
  await fs.writeFile(path.join(fileDir, 'guia-reciprocidad.pdf'), MINIMAL_PDF, 'utf8')

  const rewardUrl = `${BASE_URL}/uploads/crm-files/${empresa.id}/guia-reciprocidad.pdf`
  const channel = await prisma.crmChannelConnection.create({
    data: {
      empresaId: empresa.id,
      sedeId: sede.id,
      provider: 'WEB_FORM',
      status: 'ACTIVE',
      name: 'TMP Formulario reciprocidad',
      createdById: user.id,
      settingsJson: {
        testingToken: 'tmp-e2e-token',
        publicEmbedEnabled: true,
        allowedDomains: '',
        webFormPurpose: 'INCENTIVE',
        incentiveRewardType: 'PDF',
        incentiveRewardUrl: rewardUrl,
        incentiveRewardLabel: 'Guía de reciprocidad',
        incentiveDeliveryMode: 'EMAIL',
      },
    },
  })

  const response = await fetch(`${BASE_URL}/api/crm/captures/web-form`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-crm-channel-token': 'tmp-e2e-token' },
    body: JSON.stringify({
      channelId: channel.id,
      nombre: 'Ana Reciprocidad',
      email: `ana.reciprocity.${stamp}@example.com`,
      telefono: '3001234567',
      producto: 'Diagnóstico comercial',
      formStartedAt: Date.now() - 10_000,
      landingPageUrl: `${BASE_URL}/sites/demo`,
      purpose: 'INCENTIVE',
      payload: { source: 'e2e' },
    }),
  })
  const payload = await response.json().catch(() => null) as {
    error?: string
    data?: { leadId?: string; captureId?: string; conversationId?: string | null; messageId?: string | null; reward?: unknown }
  } | null

  check('POST web-form responde 201', response.status === 201, payload?.error ?? String(response.status))
  check('Respuesta con leadId', Boolean(payload?.data?.leadId), payload?.data?.leadId)
  check('Respuesta abre conversación', Boolean(payload?.data?.conversationId), payload?.data?.conversationId)
  check('Respuesta con mensaje', Boolean(payload?.data?.messageId), payload?.data?.messageId)
  console.log(`     reward: ${JSON.stringify(payload?.data?.reward)}`)


  const lead = payload?.data?.leadId ? await prisma.crmLead.findUnique({ where: { id: payload.data.leadId } }) : null
  check('Lead con origen del formulario', lead?.formName === 'TMP Formulario reciprocidad', lead ? { formName: lead.formName, sourceKey: lead.sourceKey } : null)
  check('Lead con lastActivityAt', Boolean(lead?.lastActivityAt), lead?.lastActivityAt?.toISOString())

  const capture = payload?.data?.captureId ? await prisma.crmLeadCapture.findUnique({ where: { id: payload.data.captureId } }) : null
  check('Captura registrada', Boolean(capture), capture?.id)
  check('Captura vinculada a conversación', Boolean(capture?.conversationId), capture?.conversationId)

  const conversation = payload?.data?.conversationId
    ? await prisma.crmConversation.findUnique({ where: { id: payload.data.conversationId } })
    : null
  check('Conversación en el inbox', Boolean(conversation), conversation ? { status: conversation.status, unread: conversation.unreadCount } : null)

  const message = payload?.data?.messageId ? await prisma.crmMessage.findUnique({ where: { id: payload.data.messageId } }) : null
  check('Mensaje FORM_SUBMISSION', message?.messageType === 'FORM_SUBMISSION', message?.messageType)

  const attachment = await loadRewardPdfAttachment({ rewardUrl, empresaId: empresa.id, rewardLabel: 'Guía de reciprocidad' })
  check('PDF se carga como adjunto', attachment.ok, attachment.ok
    ? { filename: attachment.attachment.filename, bytes: attachment.attachment.content.length }
    : attachment.reason)

  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET || 'tmp-e2e-secret'
  const signed = buildPublicCrmFileRewardUrl({ rewardUrl, empresaId: empresa.id, rewardType: 'PDF', secret, baseUrl: BASE_URL })
  const token = signed.split('token=')[1] ?? ''
  const decoded = verifyCrmFileShareToken(decodeURIComponent(token), secret)
  check('Enlace firmado descarga (attachment)', decoded?.disposition === 'attachment', decoded?.disposition)

  await prisma.notification.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmConversation.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmLeadCapture.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmActivity.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmLead.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmContact.deleteMany({ where: { empresaId: empresa.id } })
  await prisma.crmChannelConnection.deleteMany({ where: { empresaId: empresa.id } })
  await fs.rm(fileDir, { recursive: true, force: true }).catch(() => undefined)
  await prisma.user.delete({ where: { id: user.id } })
  await prisma.sede.delete({ where: { id: sede.id } })
  await prisma.empresa.delete({ where: { id: empresa.id } })

  console.log(`\n${failures === 0 ? 'TODO OK' : `${failures} FALLOS`}`)
  await prisma.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
