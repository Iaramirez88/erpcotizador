type SendWhatsAppArgs = {
  to: string
  message: string
}

export async function sendWhatsApp(args: SendWhatsAppArgs): Promise<
  | { ok: true }
  | {
      ok: false
      status?: number
      error: string
    }
> {
  const url = process.env.WHATSAPP_WEBHOOK_URL
  if (!url) {
    return { ok: false, error: 'WhatsApp no configurado (falta WHATSAPP_WEBHOOK_URL).' }
  }

  const token = process.env.WHATSAPP_WEBHOOK_TOKEN

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ to: args.to, message: args.message }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        status: res.status,
        error: text || `Error WhatsApp (HTTP ${res.status})`,
      }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error inesperado' }
  }
}
