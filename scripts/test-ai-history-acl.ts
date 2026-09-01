import fs from 'fs/promises'
import path from 'path'
import { appendAiWorkspaceHistory, queryAiWorkspaceHistory, queryAiWorkspaceHistoryPage } from '../src/lib/ai-workspace-history'
import { getCrmFileItemByPath, getCrmFilesRootAbsolutePath, getCrmFilesSnapshot, uploadCrmFiles } from '../src/lib/crm-files'
import { createPendingLitografiaAiImage, deletePendingLitografiaAiImage, readPendingLitografiaAiImage } from '../src/lib/litografia-ai-pending-images'
import { createPendingLitografiaAiVectorization, deletePendingLitografiaAiVectorization, readPendingLitografiaAiVectorization } from '../src/lib/litografia-ai-pending-vectorizations'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function expectFailure(action: () => Promise<unknown>, expectedMessage: string) {
  try {
    await action()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    assert(message.includes(expectedMessage), `Se esperaba error con "${expectedMessage}" y llegó "${message}"`)
    return
  }

  throw new Error(`Se esperaba fallo con mensaje que incluyera "${expectedMessage}"`)
}

async function removeIfExists(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => null)
}

async function main() {
  const empresaId = `test-ai-acl-${Date.now()}`
  const userA = 'user-a'
  const userB = 'user-b'
  const userAdmin = 'user-admin'
  const historyStorePath = path.join(process.cwd(), '.runtime-data', 'ai-workspace-history', `${empresaId}.json`)
  const pendingImagesPath = path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-images', empresaId)
  const pendingVectorsPath = path.join(process.cwd(), '.runtime-data', 'litografia-ai-pending-vectorizations', empresaId)
  const crmFilesRootPath = getCrmFilesRootAbsolutePath(empresaId)
  const crmFilesMetadataPath = path.join(process.cwd(), '.runtime-data', 'crm-files', `${empresaId}.json`)

  await removeIfExists(historyStorePath)
  await removeIfExists(pendingImagesPath)
  await removeIfExists(pendingVectorsPath)
  await removeIfExists(crmFilesRootPath)
  await removeIfExists(crmFilesMetadataPath)

  try {
    await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'IMAGE_GENERATION',
        prompt: 'imagen propia usuario A',
        actorUserId: userA,
        actorLabel: 'Usuario A',
        summary: 'Imagen A',
        responseText: 'Generada por A',
        metadata: { pendingId: 'pending-a' },
        asset: null,
      },
    })

    await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'IMAGE_VECTORIZATION',
        prompt: 'vector propio usuario B',
        actorUserId: userB,
        actorLabel: 'Usuario B',
        summary: 'Vector B',
        responseText: 'Generado por B',
        metadata: { pendingId: 'pending-b', imageToken: 'token-b' },
        asset: null,
      },
    })

    await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'CRM_CONVERSATION_COPILOT',
        prompt: 'seguimiento lead',
        actorUserId: userA,
        actorLabel: 'Usuario A',
        summary: 'Copiloto CRM A',
        responseText: 'Sugerencia A',
        metadata: { conversationId: 'conv-a' },
        asset: null,
      },
    })

    const userAHistory = await queryAiWorkspaceHistory({
      empresaId,
      limit: 120,
      actorUserId: userA,
    })
    assert(userAHistory.length === 2, `Se esperaban 2 eventos para ${userA} y llegaron ${userAHistory.length}`)
    assert(userAHistory.every((entry) => entry.actorUserId === userA), 'El filtro por actor devolvió eventos de otro usuario')

    const userBVectorPage = await queryAiWorkspaceHistoryPage({
      empresaId,
      kinds: ['IMAGE_VECTORIZATION'],
      actorUserId: userB,
      page: 1,
      pageSize: 10,
    })
    assert(userBVectorPage.total === 1, `Se esperaba 1 vector para ${userB} y llegaron ${userBVectorPage.total}`)
    assert(userBVectorPage.items[0]?.metadata?.imageToken === 'token-b', 'El vector filtrado no corresponde al usuario esperado')

    const pendingImage = await createPendingLitografiaAiImage({
      empresaId,
      actorUserId: userA,
      prompt: 'mock image',
      revisedPrompt: null,
      size: '1024x1024',
      quality: 'auto',
      provider: 'OpenAI',
      model: 'gpt-image-1',
      mimeType: 'image/png',
      base64: Buffer.from('png-mock').toString('base64'),
    })
    const reloadedImage = await readPendingLitografiaAiImage({ empresaId, pendingId: pendingImage.id })
    assert(reloadedImage?.actorUserId === userA, 'La imagen pendiente no conservó el actorUserId')

    const pendingVector = await createPendingLitografiaAiVectorization({
      empresaId,
      actorUserId: userB,
      sourceFileName: 'logo.png',
      sourceMimeType: 'image/png',
      sourceSizeBytes: 123,
      provider: 'Vectorizer.AI',
      outputFormat: 'svg',
      imageToken: 'token-z',
      base64: Buffer.from('<svg></svg>').toString('base64'),
    })
    const reloadedVector = await readPendingLitografiaAiVectorization({ empresaId, pendingId: pendingVector.id })
    assert(reloadedVector?.actorUserId === userB, 'La vectorización pendiente no conservó el actorUserId')

    const [savedImage] = await uploadCrmFiles({
      empresaId,
      currentPath: 'IA/chatgpt-imagenes',
      currentUserId: userA,
      bootstrapSharedFolders: true,
      actor: { userId: userA, label: 'Usuario A' },
      files: [{ name: 'ia-image-a.png', type: 'image/png', bytes: Buffer.from('png-mock') }],
    })
    assert(savedImage.path.includes('IA/chatgpt-imagenes/'), 'La imagen IA debía guardarse dentro de la carpeta técnica de Drive')
    assert(savedImage.createdById === userA, 'La imagen IA guardada debía conservar el actor creador')

    const [savedVector] = await uploadCrmFiles({
      empresaId,
      currentPath: 'IA/vectorizer-ai',
      currentUserId: userB,
      bootstrapSharedFolders: true,
      actor: { userId: userB, label: 'Usuario B' },
      files: [{ name: 'ia-vector-b.svg', type: 'image/svg+xml', bytes: Buffer.from('<svg></svg>') }],
    })
    assert(savedVector.path.includes('IA/vectorizer-ai/'), 'El vector IA debía guardarse dentro de la carpeta técnica de Drive')
    assert(savedVector.createdById === userB, 'El vector IA guardado debía conservar el actor creador')

    const userASnapshot = await getCrmFilesSnapshot({ empresaId, currentPath: 'IA/chatgpt-imagenes', currentUserId: userA })
    assert(userASnapshot.items.some((item) => item.path === savedImage.path), 'El actor dueño debe listar su imagen IA guardada')

    await expectFailure(
      () => getCrmFilesSnapshot({ empresaId, currentPath: 'IA/chatgpt-imagenes', currentUserId: userB }),
      'No tienes acceso',
    )

    await expectFailure(
      () => getCrmFileItemByPath({ empresaId, entryPath: savedImage.path, currentUserId: userB }),
      'No tienes acceso',
    )

    const adminImage = await getCrmFileItemByPath({ empresaId, entryPath: savedImage.path, currentUserId: userAdmin, bypassAccessControl: true })
    assert(adminImage.path === savedImage.path, 'Admin con bypass debe poder leer la imagen IA guardada')

    const adminVectorSnapshot = await getCrmFilesSnapshot({ empresaId, currentPath: 'IA/vectorizer-ai', currentUserId: userAdmin, bypassAccessControl: true })
    assert(adminVectorSnapshot.items.some((item) => item.path === savedVector.path), 'Admin con bypass debe listar la carpeta técnica del vectorizador')

    console.log('OK ai-history-acl')
  } finally {
    await deletePendingLitografiaAiImage({ empresaId, pendingId: 'pending-a' }).catch(() => null)
    await deletePendingLitografiaAiVectorization({ empresaId, pendingId: 'pending-b' }).catch(() => null)
    await removeIfExists(historyStorePath)
    await removeIfExists(pendingImagesPath)
    await removeIfExists(pendingVectorsPath)
    await removeIfExists(crmFilesRootPath)
    await removeIfExists(crmFilesMetadataPath)
  }
}

main().catch((error) => {
  console.error('FAIL ai-history-acl', error)
  process.exit(1)
})