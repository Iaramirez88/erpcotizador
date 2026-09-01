import { CrmFilesManagerClient } from '@/components/crm/crm-files-manager-client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser } from '@/lib/rbac'
import { resolveUserIdFromSession } from '@/lib/session-user'

export default async function CrmArchivosPage() {
  const session = await auth()
  const currentUserId = session ? await resolveUserIdFromSession(session) : null

  let canViewAllFiles = session?.user?.role === 'ADMIN'
  let activeSedeId: string | null = null

  if (currentUserId) {
    const activeSede = await getActiveSedeForUser(currentUserId)
    activeSedeId = activeSede.id

    const membership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: activeSede.id, userId: currentUserId } },
      select: { role: true },
    })

    canViewAllFiles = canViewAllFiles || membership?.role === 'ADMIN'
  }

  return <CrmFilesManagerClient currentUserId={currentUserId} canViewAllFiles={canViewAllFiles} activeSedeId={activeSedeId} />
}