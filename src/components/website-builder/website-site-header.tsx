'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { sanitizeWebsiteLinkHref } from '@/lib/website-embed'
import type { WebsiteHeaderSettings } from '@/lib/website-site-settings'

export default function WebsiteSiteHeader({ header }: { header: WebsiteHeaderSettings }) {
  const [open, setOpen] = useState(false)

  const showToggle = header.links.length > 0 || Boolean(header.buttonLabel)

  return (
    <header
      className="jc-site-header"
      style={{
        backgroundColor: header.backgroundColor,
        color: header.textColor,
        position: header.sticky ? 'sticky' : 'relative',
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="jc-site-header-inner">
        <a href="/" className="jc-site-brand">
          {header.logoUrl ? <img src={header.logoUrl} alt={header.brand || 'Logo'} /> : <span>{header.brand || 'Mi marca'}</span>}
        </a>

        <nav className="jc-site-nav">
          {header.links.map((link, index) => (
            <a key={`${link.href}-${index}`} href={sanitizeWebsiteLinkHref(link.href)}>{link.label}</a>
          ))}
        </nav>

        {header.buttonLabel ? (
          <a className="jc-site-btn jc-site-header-btn" href={sanitizeWebsiteLinkHref(header.buttonHref)}>{header.buttonLabel}</a>
        ) : null}

        {showToggle ? (
          <button
            type="button"
            className="jc-site-menu-toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="jc-site-mobile-menu">
          <nav className="jc-site-mobile-nav">
            {header.links.map((link, index) => (
              <a key={`${link.href}-${index}`} href={sanitizeWebsiteLinkHref(link.href)} onClick={() => setOpen(false)}>{link.label}</a>
            ))}
          </nav>
          {header.buttonLabel ? (
            <a className="jc-site-btn" href={sanitizeWebsiteLinkHref(header.buttonHref)} onClick={() => setOpen(false)}>{header.buttonLabel}</a>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}
