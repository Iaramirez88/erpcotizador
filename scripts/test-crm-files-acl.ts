import fs from 'fs/promises'
import path from 'path'
import {
  createCrmFolder,
  deleteCrmEntry,
  getCrmFileItemByPath,
  getCrmFilesRootAbsolutePath,
  getCrmFilesSnapshot,
  moveCrmEntry,
  renameCrmEntry,
  updateCrmEntrySharing,
  uploadCrmFiles,
} from '../src/lib/crm-files'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function removeIfExists(targetPath: string) {
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => null)
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

async function main() {
  const empresaId = `test-crm-files-acl-${Date.now()}`
  const userAdmin = 'user-admin'
  const userSedeA = 'user-sede-a'
  const userSedeB = 'user-sede-b'
  const userC = 'user-c'
  const rootPath = getCrmFilesRootAbsolutePath(empresaId)
  const metadataPath = path.join(process.cwd(), '.runtime-data', 'crm-files', `${empresaId}.json`)

  await removeIfExists(rootPath)
  await removeIfExists(metadataPath)

  try {
    const privateFolder = await createCrmFolder({
      empresaId,
      currentUserId: userSedeA,
      name: 'privado-a',
      actor: { userId: userSedeA, label: 'Usuario sede A' },
    })

    const [privateFile] = await uploadCrmFiles({
      empresaId,
      currentPath: privateFolder.path,
      currentUserId: userSedeA,
      actor: { userId: userSedeA, label: 'Usuario sede A' },
      files: [{ name: 'logo-a.png', type: 'image/png', bytes: Buffer.from('png-a') }],
    })

    const privateFolderB = await createCrmFolder({
      empresaId,
      currentUserId: userSedeB,
      name: 'privado-b',
      actor: { userId: userSedeB, label: 'Usuario sede B' },
    })

    const [privateFileB] = await uploadCrmFiles({
      empresaId,
      currentPath: privateFolderB.path,
      currentUserId: userSedeB,
      actor: { userId: userSedeB, label: 'Usuario sede B' },
      files: [{ name: 'logo-b.png', type: 'image/png', bytes: Buffer.from('png-b') }],
    })

    const rootForUserSedeB = await getCrmFilesSnapshot({ empresaId, currentUserId: userSedeB })
    assert(!rootForUserSedeB.items.some((item) => item.path === privateFolder.path), 'Usuario sede B no debería ver carpeta privada de sede A en el listado raíz')

    await expectFailure(
      () => getCrmFilesSnapshot({ empresaId, currentPath: privateFolder.path, currentUserId: userSedeB }),
      'No tienes acceso',
    )

    await expectFailure(
      () => getCrmFileItemByPath({ empresaId, entryPath: privateFile.path, currentUserId: userSedeB }),
      'No tienes acceso',
    )

    const rootForUserSedeA = await getCrmFilesSnapshot({ empresaId, currentUserId: userSedeA })
    assert(!rootForUserSedeA.items.some((item) => item.path === privateFolderB.path), 'Usuario sede A no debería ver carpeta privada de sede B en el listado raíz')

    await expectFailure(
      () => getCrmFilesSnapshot({ empresaId, currentPath: privateFolderB.path, currentUserId: userSedeA }),
      'No tienes acceso',
    )

    await expectFailure(
      () => getCrmFileItemByPath({ empresaId, entryPath: privateFileB.path, currentUserId: userSedeA }),
      'No tienes acceso',
    )

    const sharedPrivateFolder = await updateCrmEntrySharing({
      empresaId,
      entryPath: privateFolder.path,
      currentUserId: userSedeA,
      sharedWithUserIds: [userSedeB],
      actor: { userId: userSedeA, label: 'Usuario sede A' },
    })
    assert(sharedPrivateFolder.sharedWithUserIds.includes(userSedeB), 'La carpeta privada debía poder compartirse explícitamente con un usuario concreto')

    const privateFolderVisibleForUserSedeB = await getCrmFilesSnapshot({ empresaId, currentPath: privateFolder.path, currentUserId: userSedeB })
    assert(privateFolderVisibleForUserSedeB.currentPath === privateFolder.path, 'Usuario sede B debería acceder a la carpeta solo después de la compartición explícita')
    assert(privateFolderVisibleForUserSedeB.items.some((item) => item.path === privateFile.path), 'La compartición de carpeta debe extender el acceso al contenido ya existente')

    const privateFileVisibleForUserSedeB = await getCrmFileItemByPath({ empresaId, entryPath: privateFile.path, currentUserId: userSedeB })
    assert(privateFileVisibleForUserSedeB.path === privateFile.path, 'Usuario sede B debería leer el archivo tras compartición explícita de la carpeta')

    const sharedFolder = await createCrmFolder({
      empresaId,
      currentUserId: userSedeA,
      name: 'compartido-a-b',
      sharedWithUserIds: [userSedeB],
      actor: { userId: userSedeA, label: 'Usuario sede A' },
    })

    const rootSharedForUserSedeB = await getCrmFilesSnapshot({ empresaId, currentUserId: userSedeB })
    assert(rootSharedForUserSedeB.items.some((item) => item.path === sharedFolder.path), 'Usuario sede B debería ver carpeta compartida por ACL explícita')

    const [uploadedByB] = await uploadCrmFiles({
      empresaId,
      currentPath: sharedFolder.path,
      currentUserId: userSedeB,
      actor: { userId: userSedeB, label: 'Usuario sede B' },
      files: [{ name: 'brief.txt', type: 'text/plain', bytes: Buffer.from('brief') }],
    })
    assert(uploadedByB.createdById === userSedeB, 'El archivo subido por sede B debe conservar createdById del actor')

    const renamedByB = await renameCrmEntry({
      empresaId,
      entryPath: uploadedByB.path,
      currentUserId: userSedeB,
      newName: 'brief-final.txt',
      actor: { userId: userSedeB, label: 'Usuario sede B' },
    })
    assert(renamedByB.name === 'brief-final.txt', 'El rename bajo ACL compartida no se aplicó')

    const destinationFolder = await createCrmFolder({
      empresaId,
      currentPath: sharedFolder.path,
      currentUserId: userSedeB,
      name: 'destino-b',
      actor: { userId: userSedeB, label: 'Usuario sede B' },
    })

    const movedByB = await moveCrmEntry({
      empresaId,
      entryPath: renamedByB.path,
      targetDirectoryPath: destinationFolder.path,
      currentUserId: userSedeB,
      actor: { userId: userSedeB, label: 'Usuario sede B' },
    })
    assert(movedByB.directoryPath === destinationFolder.path, 'El move bajo ACL compartida no aterrizó en la carpeta destino')

    await expectFailure(
      () => getCrmFileItemByPath({ empresaId, entryPath: movedByB.path, currentUserId: userC }),
      'No tienes acceso',
    )

    const sharedFileForUserC = await updateCrmEntrySharing({
      empresaId,
      entryPath: movedByB.path,
      currentUserId: userSedeA,
      sharedWithUserIds: [userC],
      actor: { userId: userSedeA, label: 'Usuario sede A' },
    })
    assert(sharedFileForUserC.sharedWithUserIds.includes(userC), 'La compartición explícita del archivo no se guardó')

    const fileVisibleForUserC = await getCrmFileItemByPath({ empresaId, entryPath: movedByB.path, currentUserId: userC })
    assert(fileVisibleForUserC.path === movedByB.path, 'Usuario C debería poder leer el archivo tras compartición explícita')

    const adminSnapshot = await getCrmFilesSnapshot({ empresaId, currentUserId: userAdmin, bypassAccessControl: true })
    assert(adminSnapshot.items.some((item) => item.path === privateFolder.path), 'Admin con bypass debe ver carpeta privada de A')
    assert(adminSnapshot.items.some((item) => item.path === privateFolderB.path), 'Admin con bypass debe ver carpeta privada de B')
    const adminPrivateFile = await getCrmFileItemByPath({ empresaId, entryPath: privateFile.path, currentUserId: userAdmin, bypassAccessControl: true })
    assert(adminPrivateFile.path === privateFile.path, 'Admin con bypass debe leer archivo privado de A')
    const adminPrivateFileB = await getCrmFileItemByPath({ empresaId, entryPath: privateFileB.path, currentUserId: userAdmin, bypassAccessControl: true })
    assert(adminPrivateFileB.path === privateFileB.path, 'Admin con bypass debe leer archivo privado de B')

    const deletedByB = await deleteCrmEntry({ empresaId, entryPath: movedByB.path, currentUserId: userSedeB })
    assert(deletedByB.type === 'file', 'La eliminación bajo ACL compartida debía devolver tipo file')

    await expectFailure(
      () => getCrmFileItemByPath({ empresaId, entryPath: movedByB.path, currentUserId: userSedeA }),
      'no existe',
    )

    console.log('OK crm-files-acl')
  } finally {
    await removeIfExists(rootPath)
    await removeIfExists(metadataPath)
  }
}

main().catch((error) => {
  console.error('FAIL crm-files-acl', error)
  process.exit(1)
})