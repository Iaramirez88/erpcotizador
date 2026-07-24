type SendTelegramArgs = {
  chatId: string
  message: string
}

export async function sendTelegramMessage(args: SendTelegramArgs): Promise<
  | { ok: true }
  | {
      ok: false
      status?: number
      error: string
    }
> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return { ok: false, error: 'Telegram no configurado (falta TELEGRAM_BOT_TOKEN).' }
  }

  const chatId = args.chatId.trim()
  if (!chatId) {
    return { ok: false, error: 'Telegram requiere chatId válido.' }
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: args.message,
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        status: res.status,
        error: text || `Error Telegram (HTTP ${res.status})`,
      }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Error inesperado' }
  }
}
