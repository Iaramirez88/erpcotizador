export type CrmChannelProvider =
  | 'WHATSAPP_CLOUD'
  | 'WHATSAPP_SANDBOX'
  | 'FACEBOOK_PAGE'
  | 'MESSENGER'
  | 'WEB_FORM'
  | 'WEB_CHATBOT'
  | 'INSTAGRAM_DM'

export type CrmBridgeKind = 'GENERIC' | 'BOOKING' | 'GMAIL' | 'OUTLOOK' | 'GOOGLE_SHEETS' | 'GOOGLE_CALENDAR' | 'MICROSOFT_365_CALENDAR' | 'SLACK' | 'TEAMS' | 'META_LEAD_ADS' | 'EXTERNAL_FORM' | 'TIKTOK' | 'YOUTUBE'

type BookingSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  selector?: string
}

type BookingIframeArgs = {
  baseUrl: string
  channelId: string
  height?: string
}

type WebFormSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  selector?: string
}

type WebFormIframeArgs = {
  baseUrl: string
  channelId: string
  height?: string
}

type ChatbotSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  title?: string
  prompt?: string
  accentColor?: string
  backgroundColor?: string
  launcherLabel?: string
  launcherIcon?: string
  launcherPosition?: 'right' | 'center' | 'left'
  launcherPlacement?: 'fixed' | 'absolute'
  launcherSize?: 'compact' | 'standard' | 'large'
  launcherOffsetX?: string
  launcherOffsetY?: string
  launcherZIndex?: string
  panelZIndex?: string
  backdropZIndex?: string
  customCss?: string
}

type ChatbotIframeArgs = {
  baseUrl: string
  channelId: string
  height?: string
  floatingLauncherEnabled?: boolean
  launcherStartsCollapsed?: boolean
  launcherPosition?: 'right' | 'center' | 'left'
  launcherPlacement?: 'fixed' | 'absolute'
  launcherOffsetX?: string
  launcherOffsetY?: string
  panelZIndex?: string
  chatShellRadius?: string
  backgroundColor?: string
}

type ChatbotEmbedMode = 'iframe' | 'widget'

type GmailSnippetArgs = {
  baseUrl: string
  channelId: string
  token: string
  labelName?: string
}

export function getChannelProviderLabel(provider: CrmChannelProvider, bridgeKind?: string | null) {
  if (provider === 'WEB_FORM') {
    switch (bridgeKind) {
      case 'BOOKING':
        return 'Agenda Web'
      case 'GMAIL':
        return 'Gmail Inbox Bridge'
      case 'OUTLOOK':
        return 'Outlook Inbox Bridge'
      case 'GOOGLE_SHEETS':
        return 'Google Sheets Bridge'
      case 'GOOGLE_CALENDAR':
        return 'Google Calendar Bridge'
      case 'MICROSOFT_365_CALENDAR':
        return 'Microsoft 365 Calendar Bridge'
      case 'SLACK':
        return 'Slack Alerts Bridge'
      case 'TEAMS':
        return 'Microsoft Teams Alerts Bridge'
      case 'META_LEAD_ADS':
        return 'Meta Lead Ads Bridge'
      case 'EXTERNAL_FORM':
        return 'External Form Bridge'
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
      producto: data.get('producto') || data.get('product') || '',
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

export function buildWebFormEmbedUrl(baseUrl: string, channelId: string) {
  return `${baseUrl}/form/${channelId}`
}

export function buildBookingEmbedUrl(baseUrl: string, channelId: string) {
  return `${baseUrl}/booking/${channelId}`
}

export function buildWebFormIframeSnippet(args: WebFormIframeArgs) {
  const height = (args.height || '840').replace(/[^0-9]/g, '') || '840'
  const src = buildWebFormEmbedUrl(args.baseUrl, args.channelId)

  return `<iframe
  src="${src}"
  title="Formulario CRM SGDigital"
  loading="lazy"
  style="width:100%;min-height:${height}px;border:0;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.16);background:#ffffff;"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>`
}

export function buildBookingIframeSnippet(args: BookingIframeArgs) {
  const height = (args.height || '960').replace(/[^0-9]/g, '') || '960'
  const src = buildBookingEmbedUrl(args.baseUrl, args.channelId)

  return `<iframe
  src="${src}"
  title="Agenda CRM SGDigital"
  loading="lazy"
  style="width:100%;min-height:${height}px;border:0;border-radius:24px;box-shadow:0 24px 60px rgba(15,23,42,.16);background:#ffffff;"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>`
}

export function buildBookingSnippet(args: BookingSnippetArgs) {
  const selector = args.selector || '#booking-form'
  return `<script>
(function () {
  const endpoint = '${args.baseUrl}/api/crm/captures/booking';
  const channelId = '${args.channelId}';
  const token = '${args.token}';
  const selector = '${selector}';

  function serializeForm(form) {
    const data = new FormData(form);
    return {
      nombre: data.get('nombre') || data.get('name') || '',
      email: data.get('email') || '',
      telefono: data.get('telefono') || data.get('phone') || '',
      producto: data.get('servicio') || data.get('producto') || data.get('service') || '',
      mensaje: data.get('mensaje') || data.get('message') || '',
      startsAt: data.get('startsAt') || data.get('fechaHora') || data.get('datetime') || '',
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
      console.error('CRM booking failed');
      return;
    }

    form.dispatchEvent(new CustomEvent('sgdigital:crm-booking-created', { detail: body }));
    form.reset();
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.querySelector(selector);
    if (!form) {
      console.warn('SGDigital CRM: no se encontró el formulario de agenda', selector);
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
  const accentColor = args.accentColor || '#1d4ed8'
  const backgroundColor = args.backgroundColor || '#f8fbff'
  const launcherLabel = args.launcherLabel || title
  const launcherIcon = args.launcherIcon || 'chat'
  const launcherPosition = args.launcherPosition === 'left' ? 'left' : args.launcherPosition === 'center' ? 'center' : 'right'
  const launcherPlacement = args.launcherPlacement === 'absolute' ? 'absolute' : 'fixed'
  const launcherSize = args.launcherSize === 'compact' ? 'compact' : args.launcherSize === 'large' ? 'large' : 'standard'
  const customCss = args.customCss || ''
  const iframeUrl = buildChatbotEmbedUrl(args.baseUrl, args.channelId, 'iframe')
  const iconMarkup = launcherIcon === 'sparkles'
    ? '&#10024;'
    : launcherIcon === 'message-circle'
      ? '&#128172;'
      : launcherIcon === 'bot'
        ? '&#129302;'
        : '&#128172;'
  const launcherOffset = `${(args.launcherOffsetY || '60').replace(/[^0-9]/g, '') || '60'}px`
  const launcherOffsetX = `${(args.launcherOffsetX || '60').replace(/[^0-9]/g, '') || '60'}px`
  const panelOffset = `${Number.parseInt((args.launcherOffsetY || '60').replace(/[^0-9]/g, '') || '60', 10) + 88}px`
  const launcherAnchorStyle = launcherPosition === 'left' ? `left:${launcherOffsetX};` : launcherPosition === 'center' ? 'left:50%;transform:translateX(-50%);' : `right:${launcherOffsetX};`
  const panelAnchorStyle = launcherPosition === 'left' ? `left:${launcherOffsetX};` : launcherPosition === 'center' ? 'left:50%;transform:translateX(-50%);' : `right:${launcherOffsetX};`
  const panelTransformOrigin = launcherPosition === 'left' ? 'bottom left' : launcherPosition === 'center' ? 'bottom center' : 'bottom right'
  const launcherLabelMarkup = launcherSize === 'compact' ? '' : `<span>${launcherLabel}</span>`
  const backdropZIndex = Number.parseInt((args.backdropZIndex || '2147483645').replace(/[^0-9-]/g, '') || '2147483645', 10)
  const panelZIndex = Number.parseInt((args.panelZIndex || '2147483646').replace(/[^0-9-]/g, '') || '2147483646', 10)
  const launcherZIndex = Number.parseInt((args.launcherZIndex || '2147483647').replace(/[^0-9-]/g, '') || '2147483647', 10)
  const launcherButtonStyle = launcherSize === 'compact'
    ? `position:${launcherPlacement};bottom:${launcherOffset};${launcherAnchorStyle}z-index:${launcherZIndex};border:none;border-radius:999px;width:58px;height:58px;background:${accentColor};color:#fff;font:700 14px sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0;backdrop-filter:blur(14px);`
    : launcherSize === 'large'
      ? `position:${launcherPlacement};bottom:${launcherOffset};${launcherAnchorStyle}z-index:${launcherZIndex};border:none;border-radius:999px;padding:0 24px;height:66px;background:${accentColor};color:#fff;font:700 15px sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);cursor:pointer;display:flex;align-items:center;gap:12px;backdrop-filter:blur(14px);`
      : `position:${launcherPlacement};bottom:${launcherOffset};${launcherAnchorStyle}z-index:${launcherZIndex};border:none;border-radius:999px;padding:0 20px;height:60px;background:${accentColor};color:#fff;font:700 14px sans-serif;box-shadow:0 18px 40px rgba(15,23,42,.22);cursor:pointer;display:flex;align-items:center;gap:10px;backdrop-filter:blur(14px);`

  return `<script>
(function () {
  if (window.__sgdChatbotWidgetMounted) return;
  window.__sgdChatbotWidgetMounted = true;

  const panelId = 'sgd-crm-chatbot-panel';
  const backdropId = 'sgd-crm-chatbot-backdrop';
  const launcherId = 'sgd-crm-chatbot-launcher';
  const styleId = 'sgd-crm-chatbot-styles';
  const iframeUrl = '${iframeUrl}';

  function createNode(tag, style, html) {
    const node = document.createElement(tag);
    node.style.cssText = style;
    if (html) node.innerHTML = html;
    return node;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = '\n    @keyframes sgd-chatbot-launcher-in {\n      from { opacity: 0; transform: translateY(24px) scale(.82); }\n      to { opacity: 1; transform: translateY(0) scale(1); }\n    }\n    @keyframes sgd-chatbot-launcher-pulse {\n      0%, 100% { box-shadow: 0 18px 40px rgba(15,23,42,.22); }\n      50% { box-shadow: 0 22px 52px rgba(15,23,42,.30); }\n    }\n    #'+launcherId+' {\n      opacity: 0;\n      transform: translateY(24px) scale(.82);\n      transition: transform .28s ease, box-shadow .28s ease, filter .28s ease;\n      animation: sgd-chatbot-launcher-in .55s cubic-bezier(.22,1,.36,1) forwards, sgd-chatbot-launcher-pulse 3.8s ease-in-out .75s infinite;\n      position: fixed !important;\n      z-index: ${launcherZIndex} !important;\n      isolation: isolate;\n    }\n    #'+launcherId+':hover {\n      transform: translateY(-2px) scale(1.02);\n      filter: saturate(1.05);\n    }\n    #'+backdropId+' {\n      opacity: 0;\n      pointer-events: none;\n      transition: opacity .26s ease;\n      position: fixed !important;\n      z-index: ${backdropZIndex} !important;\n      isolation: isolate;\n    }\n    #'+backdropId+'.is-open {\n      opacity: 1;\n      pointer-events: auto;\n    }\n    #'+panelId+' {\n      opacity: 0;\n      transform: translateY(18px) scale(.92);\n      transform-origin: ${panelTransformOrigin};\n      pointer-events: none;\n      transition: opacity .28s ease, transform .34s cubic-bezier(.22,1,.36,1);\n      position: fixed !important;\n      z-index: ${panelZIndex} !important;\n      isolation: isolate;\n    }\n    #'+panelId+'.is-open {\n      opacity: 1;\n      transform: translateY(0) scale(1);\n      pointer-events: auto;\n    }\n    #'+panelId+'.is-closing {\n      opacity: 0;\n      transform: translateY(16px) scale(.94);\n      pointer-events: none;\n    }';
  const customCss = ${JSON.stringify(customCss)};
  if (customCss) style.textContent += '\n' + customCss;
  if (!document.getElementById(styleId)) document.head.appendChild(style);

  const button = createNode('button', '${launcherButtonStyle}', '<span style="font-size:${launcherSize === 'large' ? '20px' : '16px'};line-height:1;">${iconMarkup}</span>${launcherLabelMarkup}');
  button.id = launcherId;
  const backdrop = createNode('div', 'position:fixed;inset:0;z-index:${backdropZIndex};background:linear-gradient(180deg,rgba(15,23,42,.08),rgba(15,23,42,.18));backdrop-filter:blur(3px);', '');
  backdrop.id = backdropId;
  const panel = createNode('div', 'position:fixed;bottom:${panelOffset};${panelAnchorStyle}z-index:${panelZIndex};width:min(420px,calc(100vw - 32px));height:min(760px,calc(100vh - 180px));border:1px solid rgba(148,163,184,.28);border-radius:24px;background:${backgroundColor};overflow:hidden;box-shadow:0 24px 80px rgba(15,23,42,.28);font:14px sans-serif;color:#0f172a;', '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid rgba(226,232,240,1);background:linear-gradient(135deg,#0f172a,${accentColor});color:#fff;"><div><div style="font-weight:700;font-size:16px;">${title}</div><div style="font-size:12px;opacity:.9;margin-top:4px;">${prompt}</div></div><button type="button" id="sgd-chatbot-close" style="border:none;background:rgba(255,255,255,.14);color:#fff;width:34px;height:34px;border-radius:999px;cursor:pointer;font-size:18px;transition:transform .2s ease, background .2s ease;">×</button></div><iframe src="'+iframeUrl+'" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" style="display:block;width:100%;height:calc(100% - 68px);border:0;background:${backgroundColor};"></iframe>');
  panel.id = panelId;

  function openPanel() {
    backdrop.classList.add('is-open');
    panel.classList.remove('is-closing');
    requestAnimationFrame(function () {
      panel.classList.add('is-open');
    });
  }

  function closePanel() {
    backdrop.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.classList.add('is-closing');
  }

  button.addEventListener('click', function () {
    if (panel.classList.contains('is-open')) {
      closePanel();
      return;
    }
    openPanel();
  });

  backdrop.addEventListener('click', closePanel);
  document.body.appendChild(button);
  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  panel.querySelector('#sgd-chatbot-close').addEventListener('click', function () {
    closePanel();
  });
})();
</script>`
}

export function buildChatbotEmbedUrl(baseUrl: string, channelId: string, mode: ChatbotEmbedMode = 'iframe') {
  return `${baseUrl}/chatbot/${channelId}?mode=${mode}`
}

export function buildChatbotIframeSnippet(args: ChatbotIframeArgs) {
  const height = (args.height || '720').replace(/[^0-9]/g, '') || '720'
  const widgetMode = args.floatingLauncherEnabled === true
  const defaultHeightValue = Number.parseInt(height, 10)
  const collapsedHeight = widgetMode && args.launcherStartsCollapsed !== false ? '164' : height
  const src = buildChatbotEmbedUrl(args.baseUrl, args.channelId, widgetMode ? 'widget' : 'iframe')
  const iframeId = `sgd-chatbot-iframe-${args.channelId}`
  const shellRadius = `${(args.chatShellRadius || '30').replace(/[^0-9]/g, '') || '30'}px`
  const iframeBackground = widgetMode ? 'transparent' : (args.backgroundColor || '#ffffff')
  const launcherPosition = args.launcherPosition === 'left' ? 'left' : args.launcherPosition === 'center' ? 'center' : 'right'
  const launcherPlacement = args.launcherPlacement === 'absolute' ? 'absolute' : 'fixed'
  const hostAnchorStyle = launcherPosition === 'left'
    ? 'left:0;'
    : launcherPosition === 'center'
      ? 'left:50%;transform:translateX(-50%);'
      : 'right:0;'
  const panelZIndex = Number.parseInt((args.panelZIndex || '2147483646').replace(/[^0-9-]/g, '') || '2147483646', 10)
  const embedStyle = widgetMode
    ? `width:min(420px,calc(100vw - 16px));display:block;position:${launcherPlacement};bottom:0;${hostAnchorStyle}z-index:${panelZIndex};pointer-events:auto;`
    : 'width:100%;max-width:420px;display:block;'

  return `<iframe
  id="${iframeId}"
  src="${src}"
  title="Chatbot CRM SGDigital"
  loading="lazy"
  style="${embedStyle}height:${collapsedHeight}px;border:0;border-radius:${widgetMode ? '0' : shellRadius};box-shadow:${widgetMode ? 'none' : '0 24px 60px rgba(15,23,42,.16)'};background:${iframeBackground};overflow:hidden;transition:height .28s ease, box-shadow .28s ease;"
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
<script>
(function () {
  const iframe = document.getElementById('${iframeId}');
  if (!iframe) return;

  const channelId = '${args.channelId}';
  const defaultHeight = ${defaultHeightValue};
  const collapsedHeight = ${collapsedHeight};
  const maxHeight = Math.max(defaultHeight, 1600);
  const widgetMode = ${widgetMode ? 'true' : 'false'};

  function applyHeight(nextHeight, panelOpen) {
    const rawHeight = Number(nextHeight) || defaultHeight;
    const boundedHeight = Math.min(rawHeight, maxHeight);
    const isCollapsed = widgetMode && panelOpen === false;
    const minHeight = isCollapsed ? collapsedHeight : defaultHeight;
    const safeHeight = Math.max(minHeight, boundedHeight);
    iframe.style.height = safeHeight + 'px';
    iframe.style.background = '${iframeBackground}';
    iframe.style.boxShadow = widgetMode ? 'none' : '0 24px 60px rgba(15,23,42,.16)';
  }

  function handleMessage(event) {
    if (event.source !== iframe.contentWindow) return;
    const data = event.data || {};
    if (data.type !== 'sgd-chatbot-embed-resize') return;
    if (data.channelId !== channelId) return;
    applyHeight(data.height, data.panelOpen);
  }

  window.addEventListener('message', handleMessage);
  iframe.addEventListener('load', function () {
    window.setTimeout(function () {
      applyHeight(collapsedHeight, ${widgetMode && args.launcherStartsCollapsed !== false ? 'false' : 'true'});
    }, 180);
  });
})();
</script>`
}

export function buildGmailAppsScriptSnippet(args: GmailSnippetArgs) {
  const labelName = args.labelName || 'CRM/Prospectos'
  return `function extractEmail(value) {
  const match = String(value || '').match(/<([^>]+)>/);
  return match ? match[1].trim().toLowerCase() : String(value || '').trim().toLowerCase();
}

function wasProcessed(messageId) {
  return PropertiesService.getScriptProperties().getProperty('crm_processed_' + messageId) === '1';
}

function markProcessed(messageId) {
  PropertiesService.getScriptProperties().setProperty('crm_processed_' + messageId, '1');
}

function forwardLeadsToCrm() {
  const endpoint = '${args.baseUrl}/api/crm/captures/bridge';
  const channelId = '${args.channelId}';
  const token = '${args.token}';
  const label = GmailApp.getUserLabelByName('${labelName}');
  if (!label) return;

  const threads = label.getThreads(0, 20);
  threads.forEach((thread) => {
    const message = thread.getMessages().pop();
    if (!message) return;

    const messageId = message.getId();
    if (wasProcessed(messageId)) return;

    const fromRaw = message.getReplyTo() || message.getFrom();

    const payload = {
      channelId,
      token,
      fromName: message.getFrom(),
      fromAddress: extractEmail(fromRaw),
      message: message.getPlainBody().slice(0, 5000),
      subject: message.getSubject(),
      eventAt: message.getDate().toISOString(),
      payload: {
        subject: message.getSubject(),
        threadId: thread.getId(),
        messageId,
      },
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-crm-channel-token': token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const status = response.getResponseCode();
    if (status >= 200 && status < 300) {
      markProcessed(messageId);
      thread.removeLabel(label);
      return;
    }

    Logger.log('CRM Gmail Bridge error %s: %s', status, response.getContentText());
  });
}`
}

export function buildOutlookPayloadExample(baseUrl: string, channelId: string, token: string) {
  return JSON.stringify({
    endpoint: `${baseUrl}/api/crm/captures/bridge`,
    channelId,
    token,
    fromName: '{{from.displayName}}',
    fromAddress: '{{from.address}}',
    telefono: '',
    empresaNombre: '',
    ciudad: '',
    message: '{{bodyPreview}}',
    subject: '{{subject}}',
    eventAt: '{{receivedDateTime}}',
    payload: {
      subject: '{{subject}}',
      messageId: '{{id}}',
      threadId: '{{conversationId}}',
    },
  }, null, 2)
}

export function buildWebhookPayloadExample(provider: CrmChannelProvider, bridgeKind?: CrmBridgeKind | null) {
  if (provider === 'WEB_FORM' && bridgeKind === 'BOOKING') {
    return JSON.stringify({
      channelId: 'crm_channel_xxx',
      nombre: 'Camila Rojas',
      email: 'camila@example.com',
      telefono: '+573001112233',
      producto: 'Asesoría comercial',
      mensaje: 'Necesito una reunión para revisar una propuesta.',
      startsAt: '2026-05-12T10:00:00-05:00',
      landingPageUrl: 'https://cliente.com/agendar',
      referrerUrl: 'https://cliente.com/',
      utmSource: 'website',
      utmMedium: 'booking-widget',
      utmCampaign: 'agenda-home',
    }, null, 2)
  }

  if (provider === 'WEB_FORM' && bridgeKind === 'META_LEAD_ADS') {
    return JSON.stringify({
      channelId: 'crm_channel_xxx',
      payload: {
        leadgen_id: '2384-2394-8293',
        form_id: '120394820',
        campaign_name: 'Lanzamiento mayo',
        field_data: [
          { name: 'full_name', values: ['Camila Rojas'] },
          { name: 'email', values: ['camila@example.com'] },
          { name: 'phone_number', values: ['+573001112233'] },
          { name: 'company_name', values: ['Litografía Andina'] },
        ],
      },
      sourceCampaign: 'meta-mayo',
      utmMedium: 'meta-lead-ads',
    }, null, 2)
  }

  if (provider === 'WEB_FORM' && bridgeKind === 'EXTERNAL_FORM') {
    return JSON.stringify({
      channelId: 'crm_channel_xxx',
      nombre: 'Laura Torres',
      email: 'laura@example.com',
      telefono: '+573002224455',
      empresaNombre: 'Editorial Norte',
      ciudad: 'Bogotá',
      mensaje: 'Quiero una cotización para empaques.',
      landingPageUrl: 'https://partner.com/formulario',
      sourceCampaign: 'partner-landing-q2',
      utmMedium: 'external-form',
    }, null, 2)
  }

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