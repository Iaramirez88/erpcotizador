import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MobileNotificationSettings } from '@/components/config/mobile-notification-settings'

export default async function ConfiguracionNotificacionesPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  return <MobileNotificationSettings />
}