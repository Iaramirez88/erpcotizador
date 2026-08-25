import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { resolveUserIdFromSession } from '@/lib/session-user'
import RopProfileClient from './rop-profile-client'

export const runtime = 'nodejs'

export default async function RopProfilePage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/dashboard/rop')

  return <RopProfileClient />
}