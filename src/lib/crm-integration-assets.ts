export type CrmChannelProvider =
  | 'WHATSAPP_CLOUD'
  | 'WHATSAPP_SANDBOX'
  | 'FACEBOOK_PAGE'
  | 'MESSENGER'
  | 'WEB_FORM'
  | 'WEB_CHATBOT'
  | 'INSTAGRAM_DM'

export type CrmBridgeKind = 'GENERIC' | 'GMAIL' | 'OUTLOOK' | 'TIKTOK' | 'YOUTUBE'

type WebFormSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  selector?: string
}

type ChatbotSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  title?: string
  prompt?: string
}

type ChatbotIframeArgs = {
  baseUrl: string
  channelId: string
  height?: string
}

type GmailSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  labelName?: string
}

export function getChannelProviderLabel(provider: CrmChannelProvider, bridgeKind?: string | null) {
  if (provider === 'WEB_FORM') {
    switch (bridgeKind) {
      case 'GMAIL':
        return 'Gmail Inbox Bridge'
      case 'OUTLOOK':
        return 'Outlook Inbox Bridge'
      case 'TIKTOK':
        return 'TikTok Lead Bridge'
      case 'YOUTUBE':
        return 'YouTube Lead Bridge'
      default:
        return 'Formulario Web'
    }
  }

  switch (provider) {
    case 'WEB_CHATBOT':
      return 'Chatbot Web'
    case 'WHATSAPP_CLOUD':
      return 'WhatsApp Cloud'
    case 'WHATSAPP_SANDBOX':
      return 'WhatsApp Sandbox'
    case 'FACEBOOK_PAGE':
      return 'Facebook Page'
    case 'MESSENGER':
      return 'Messenger'
    case 'INSTAGRAM_DM':
      return 'Instagram DM'
    default:
      return provider
  }
}

export function makeDemoToken() {
  return `sgd_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

export function buildWebFormSnippet(args: WebFormSnippetArgs) {
  const selector = args.selector || '#lead-form'
  return `<script>
(function () {
  const endpoint = '${args.baseUrl}/api/crm/captures/web-form';
  const channelId = '${args.channelId}';
  const token = '${args.token}';
  const selector = '${selector}';

  function serializeForm(form) {
    const data = new FormData(form);
    return {
      nombre: data.get('nombre') || data.get('name') || '',
      email: data.get('email') || '',
      telefono: data.get('telefono') || data.get('phone') || '',
      empresaNombre: data.get('empresa') || data.get('company') || '',
      ciudad: data.get('ciudad') || '',
      mensaje: data.get('mensaje') || data.get('message') || '',
      landingPageUrl: window.location.href,
      referrerUrl: document.referrer || '',
      utmSource: new URLSearchParams(window.location.search).get('utm_source') || '',
      utmMedium: new URLSearchParams(window.location.search).get('utm_medium') || '',
      utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
      utmContent: new URLSearchParams(window.location.search).get('utm_content') || '',
      utmTerm: new URLSearchParams(window.location.search).get('utm_term') || ''
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = serializeForm(form);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crm-channel-token': token,
      },
      body: JSON.stringify({ channelId, ...body }),
    });

    if (!response.ok) {
      console.error('CRM capture failed');
      return;
    }

    form.dispatchEvent(new CustomEvent('sgdigital:crm-lead-captured', { detail: body }));
    form.reset();
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector(selector);
    if (!form) {
      console.warn('SGDigital CRM: no se encontró el formulario', selector);
      return;
    }
    form.addEventListener('submit', handleSubmit);
  });
})();
</script>`
}

export function buildChatbotSnippet(args: ChatbotSnippetArgs) {
  const title = args.title || 'Asesor virtual SGDigital'
  const prompt = args.prompt || 'Cuéntanos tu proyecto y te contactamos.'

  return `<script>
(function () {
  const endpoint = '${args.baseUrl}/api/crm/captures/chatbot';
  const channelId = '${args.channelId}';
  const token = '${args.token}';
  const panelId = 'sgd-crm-chatbot-panel';

  function createNode(tag, style, html) {
    const node = document.createElement(tag);
    node.style.cssText = style;
    if (html) node.innerHTML = html;
    return node;
  }

  async function submitLead(payload) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-crm-channel-token': token,
      },
      body: JSON.stringify({
        channelId,
        ...payload,
        landingPageUrl: window.location.href,
        referrerUrl: document.referrer || '',
      }),
    });
    return response.ok;
  }

  const button = createNode('button', 'position:fixed;bottom:24px;right:24px;z-index:99999;border:none;border-radius:999px;padding:14px 18px;background:linear-gradient(135deg,#0f172a,#0ea5e9);color:#fff;font:600 14px sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);cursor:pointer;', '${title}');
  const panel = createNode('div', 'display:none;position:fixed;bottom:84px;right:24px;z-index:99999;width:min(360px,calc(100vw - 32px));border:1px solid rgba(148,163,184,.28);border-radius:24px;background:#fff;padding:18px;box-shadow:0 24px 80px rgba(15,23,42,.28);font:14px sans-serif;color:#0f172a;', '<div style="font-weight:700;font-size:18px;margin-bottom:6px;">${title}</div><div style="color:#475569;line-height:1.5;margin-bottom:14px;">${prompt}</div><form id="sgd-chatbot-form" style="display:grid;gap:10px;"><input name="nombre" placeholder="Tu nombre" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;"><input name="email" placeholder="Tu email" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;"><input name="telefono" placeholder="Tu teléfono" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;"><textarea name="message" placeholder="¿Qué necesitas?" rows="4" style="padding:12px 14px;border:1px solid #cbd5e1;border-radius:14px;resize:vertical;"></textarea><button type="submit" style="border:none;border-radius:14px;padding:12px 16px;background:#0f172a;color:#fff;font-weight:600;cursor:pointer;">Enviar</button></form><div id="sgd-chatbot-status" style="margin-top:10px;color:#475569;font-size:12px;"></div>');
  panel.id = panelId;

  button.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  document.body.appendChild(button);
  document.body.appendChild(panel);

  panel.querySelector('#sgd-chatbot-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = panel.querySelector('#sgd-chatbot-status');
    status.textContent = 'Enviando...';
    const ok = await submitLead({
      nombre: data.get('nombre') || '',
      email: data.get('email') || '',
      telefono: data.get('telefono') || '',
      message: data.get('message') || '',
    });
    status.textContent = ok ? 'Gracias. Un asesor te contactará pronto.' : 'No pudimos enviar tu solicitud.';
    if (ok) form.reset();
  });
})();
</script>`
}

export function buildChatbotEmbedUrl(baseUrl: string, channelId: string) {
  return `${baseUrl}/chatbot/${channelId}`
}

export function buildChatbotIframeSnippet(args: ChatbotIframeArgs) {
  const height = (args.height || '720').replace(/[^0-9]/g, '') || '720'
  const src = buildChatbotEmbedUrl(args.baseUrl, args.channelId)

  return `<iframe
  src="${src}"
  title="Chatbot CRM SGDigital"
  loading="lazy"
  style="width:100%;max-width:420px;height:${height}px;border:0;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.16);background:#ffffff;"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>`
}

export function buildGmailAppsScriptSnippet(args: GmailSnippetArgs) {
  const labelName = args.labelName || 'CRM/Prospectos'
  return `function forwardLeadsToCrm() {
  const endpoint = '${args.baseUrl}/api/crm/captures/web-form';
  const channelId = '${args.channelId}';
  const token = '${args.token}';
  const label = GmailApp.getUserLabelByName('${labelName}');
  if (!label) return;

  const threads = label.getThreads(0, 20);
  threads.forEach((thread) => {
    const message = thread.getMessages().pop();
    if (!message) return;

    const payload = {
      channelId,
      token,
      nombre: message.getFrom(),
      email: message.getReplyTo() || message.getFrom(),
      mensaje: message.getPlainBody().slice(0, 5000),
      empresaNombre: '',
      ciudad: '',
      landingPageUrl: 'gmail://inbox',
      payload: {
        subject: message.getSubject(),
        threadId: thread.getId(),
        messageId: message.getId(),
      },
    };

    UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-crm-channel-token': token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    thread.removeLabel(label);
  });
}`
}

export function buildOutlookPayloadExample(channelId: string, token: string) {
  return JSON.stringify({
    channelId,
    token,
    nombre: '{{from.displayName}}',
    email: '{{from.address}}',
    telefono: '',
    empresaNombre: '',
    ciudad: '',
    mensaje: '{{bodyPreview}}',
    payload: {
      subject: '{{subject}}',
      messageId: '{{id}}',
      threadId: '{{conversationId}}',
    },
  }, null, 2)
}

export function buildWebhookPayloadExample(provider: CrmChannelProvider) {
  const sourcePayload = provider === 'WHATSAPP_CLOUD' || provider === 'WHATSAPP_SANDBOX'
    ? {
        externalThreadId: 'wa-573001112233',
        providerMessageId: 'wamid.HBgL...',
        sender: { id: '573001112233', name: 'Camila Rojas', phone: '+573001112233' },
        payload: { body: 'Hola, quiero una cotización para etiquetas.' },
        metadata: { campaign: 'wa-organico', medium: 'whatsapp', content: 'cta-home' },
      }
    : {
        externalThreadId: 'meta-thread-98231',
        providerMessageId: 'mid.123456789',
        sender: { id: 'meta-user-99', name: 'Juan Pérez', email: 'juan@example.com' },
        payload: { body: 'Vi su anuncio y quiero más información.' },
        metadata: { campaign: 'meta-leads-marzo', medium: 'facebook', content: 'reel-a' },
      }

  return JSON.stringify(sourcePayload, null, 2)
}