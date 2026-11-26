import type { CSSProperties, ReactNode } from 'react'
import { sanitizeWebsiteLinkHref } from '@/lib/website-embed'
import type { WebsiteSiteSettings } from '@/lib/website-site-settings'
import WebsiteSiteHeader from '@/components/website-builder/website-site-header'

const CHROME_CSS = `
.jc-site{min-height:100vh;display:flex;flex-direction:column}
.jc-site-header{border-bottom:1px solid rgba(0,0,0,.08)}
.jc-site-header-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 auto;padding:16px 24px;width:100%;max-width:var(--jc-container)}
.jc-site-brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:18px;text-decoration:none;color:inherit}
.jc-site-brand img{height:40px;width:auto;max-width:180px;object-fit:contain}
.jc-site-nav{display:flex;align-items:center;gap:24px}
.jc-site-nav a{color:inherit;opacity:.78;text-decoration:none;font-size:14px;font-weight:500}
.jc-site-nav a:hover{opacity:1}
.jc-site-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;border-radius:var(--jc-radius);background:var(--jc-accent);color:#fff;font-size:14px;font-weight:600;text-decoration:none}
.jc-site-header-btn{margin-left:8px}
.jc-site-menu-toggle{display:none;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid rgba(0,0,0,.14);border-radius:12px;background:transparent;color:inherit;cursor:pointer;flex:0 0 auto}
.jc-site-mobile-menu{display:flex;flex-direction:column;gap:6px;padding:10px 24px 18px;border-top:1px solid rgba(0,0,0,.08)}
.jc-site-mobile-nav{display:flex;flex-direction:column}
.jc-site-mobile-nav a{padding:12px 0;color:inherit;opacity:.85;text-decoration:none;font-size:15px;font-weight:500;border-bottom:1px solid rgba(0,0,0,.07)}
.jc-site-mobile-nav a:last-child{border-bottom:0}
.jc-site-footer{margin-top:auto;padding:48px 24px 32px}
.jc-site-footer-inner{display:flex;flex-wrap:wrap;gap:32px;justify-content:space-between;margin:0 auto;width:100%;max-width:var(--jc-container)}
.jc-site-footer-brand{font-weight:700;font-size:18px}
.jc-site-footer-desc{max-width:320px;margin:12px 0 0;opacity:.75;font-size:14px;line-height:1.6}
.jc-site-footer-links{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.jc-site-footer-links a{color:inherit;opacity:.75;text-decoration:none;font-size:14px}
.jc-site-footer-links a:hover{opacity:1}
.jc-site-footer-copy{width:100%;border-top:1px solid rgba(255,255,255,.16);margin-top:8px;padding-top:20px;font-size:13px;opacity:.6}
@media(max-width:640px){.jc-site-nav{display:none}.jc-site-header-btn{display:none}.jc-site-menu-toggle{display:inline-flex}.jc-site-footer-inner{flex-direction:column}}
`

export default function WebsiteSiteChrome({
  settings,
  enableScripts = false,
  children,
}: {
  settings: WebsiteSiteSettings
  enableScripts?: boolean
  children: ReactNode
}) {
  const { theme, header, footer } = settings

  const themeCss = [
    '.jc-site > main{background-color:var(--jc-bg) !important;color:var(--jc-text) !important;font-family:var(--jc-font) !important}',
    theme.headingFontFamily ? `h1,h2,h3,h4,h5,h6{font-family:${theme.headingFontFamily} !important}` : '',
  ].filter(Boolean).join('\n')

  const css = `${CHROME_CSS}\n${themeCss}\n${settings.customCss}`.trim()

  const rootStyle: CSSProperties = {
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    fontFamily: theme.fontFamily,
    '--jc-accent': theme.accentColor,
    '--jc-bg': theme.backgroundColor,
    '--jc-text': theme.textColor,
    '--jc-font': theme.fontFamily,
    '--jc-heading-font': theme.headingFontFamily,
    '--jc-radius': `${theme.buttonRadius}px`,
    '--jc-container': `${theme.containerMaxWidth}px`,
  } as CSSProperties

  return (
    <div className="jc-site" style={rootStyle}>
      {enableScripts && settings.customJsHead ? <script dangerouslySetInnerHTML={{ __html: settings.customJsHead }} /> : null}
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}

      {header.enabled ? <WebsiteSiteHeader header={header} /> : null}

      {children}

      {footer.enabled ? (
        <footer className="jc-site-footer" style={{ backgroundColor: footer.backgroundColor, color: footer.textColor }}>
          <div className="jc-site-footer-inner">
            <div>
              {footer.brand ? <div className="jc-site-footer-brand">{footer.brand}</div> : null}
              {footer.description ? <p className="jc-site-footer-desc">{footer.description}</p> : null}
            </div>
            <nav className="jc-site-footer-links">
              {footer.links.map((link, index) => (
                <a key={`${link.href}-${index}`} href={sanitizeWebsiteLinkHref(link.href)}>{link.label}</a>
              ))}
            </nav>
            {footer.copyright ? <div className="jc-site-footer-copy">{footer.copyright}</div> : null}
          </div>
        </footer>
      ) : null}

      {enableScripts && settings.customJsBody ? <script dangerouslySetInnerHTML={{ __html: settings.customJsBody }} /> : null}
    </div>
  )
}
