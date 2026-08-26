import { redirect } from 'next/navigation'
import { canAccessRopModule } from '@/lib/rop-access'
import RopProfileClient from './rop-profile-client'

export const runtime = 'nodejs'

export default async function RopProfilePage() {
  const access = await canAccessRopModule()
  if (!access.ok) redirect('/dashboard')

  return <RopProfileClient />
}