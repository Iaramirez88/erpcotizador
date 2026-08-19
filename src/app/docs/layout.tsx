import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/login?callbackUrl=%2Fdocs')
  }

  return children
}