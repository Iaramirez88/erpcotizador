import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const emailReady = Boolean(process.env.RESEND_API_KEY)
    const telegramReady = Boolean(process.env.TELEGRAM_BOT_TOKEN)
    const emailFrom = process.env.EMAIL_FROM || 'Ordex <onboarding@resend.dev>'

    return NextResponse.json({
      success: true,
      data: {
        email: {
          ready: emailReady,
          summary: emailReady ? 'Correo listo' : 'Correo no configurado',
          detail: emailReady
            ? `Resend está disponible. Remitente actual: ${emailFrom}.`
            : 'Falta RESEND_API_KEY en el servidor para enviar correos desde Notificarme.',
          requirement: 'Configura RESEND_API_KEY y opcionalmente EMAIL_FROM en el servidor.',
        },
        telegram: {
          ready: telegramReady,
          summary: telegramReady ? 'Telegram listo' : 'Telegram no configurado',
          detail: telegramReady
            ? 'El bot de Telegram está disponible para enviar mensajes desde Notificarme.'
            : 'Falta TELEGRAM_BOT_TOKEN en el servidor para enviar mensajes de Telegram.',
          requirement: 'Configura TELEGRAM_BOT_TOKEN en el servidor y usa chat IDs válidos en el campo Telegram.',
        },
      },
    })
  } catch (error) {
    console.error('Error obteniendo readiness de notificaciones:', error)
    return NextResponse.json({ error: 'No se pudo obtener el estado de notificaciones.' }, { status: 500 })
  }
}
