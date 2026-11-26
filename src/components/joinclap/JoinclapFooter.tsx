import Link from "next/link"

/* ============================================================
   Datos de contacto y redes sociales.
   REEMPLAZA los valores marcados con TODO por los datos reales.
   ============================================================ */
const CONTACTO = {
  telefono: "+57 320 2102047", // TODO: teléfono real
  telefonoHref: "tel:+573202102047", // TODO: teléfono real (solo dígitos)
  correo: "soporte@joinclap.com.co", // TODO: correo real
  direccion: "Cra 7 # 17-01 Ofc. 907, Bogotá, Colombia", // TODO: dirección real
  direccionHref:
    "https://www.google.com/maps/search/?api=1&query=Joinclap%20Bogotá", // TODO: enlace real a Google Maps
  redes: {
    facebook: "https://www.facebook.com/joinclapcol/", // TODO: URL real de Facebook
    instagram: "https://www.instagram.com/joinclap88/", // TODO: URL real de Instagram
    tiktok: "https://www.tiktok.com/@joinclapcol", // TODO: URL real de TikTok
    youtube: "https://youtube.com/@joinclapcol", // TODO: URL real de YouTube
  },
}

const EMPRESA_LINKS = [
  { label: "Precios", href: "/precios" },
  { label: "Documentación", href: "/documentacion" },
  { label: "Contacto", href: "/#contacto" },
  { label: "Términos de servicio", href: "/terminos-de-servicio" },
  { label: "Política de privacidad", href: "/politica-de-privacidad" },
  { label: "Garantía de devolución", href: "/garantia-de-devolucion" },
  { label: "Política de reembolso", href: "/politica-de-reembolso" },
]

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.9h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.9h-2.34V22C18.34 21.24 22 17.08 22 12.06z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TiktokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16.6 3c.38 2.1 1.74 3.6 3.9 3.8v2.85c-1.42 0-2.75-.46-3.9-1.24v6.03c0 3.32-2.15 5.56-5.18 5.56A4.9 4.9 0 0 1 6.5 15.1c0-2.9 2.32-5.02 5.4-4.75v2.9c-1.28-.2-2.52.6-2.52 1.85 0 1.18.97 2 2.14 1.8 1.05-.18 1.72-1.02 1.72-2.1V3h2.96z" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.82.42A2.5 2.5 0 0 0 2.42 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.42-4.81zM10 15V9l5.2 3z" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}

export default function JoinclapFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link className="brand" href="/" aria-label="Joinclap inicio">
              <img src="/brand/logo-joinclap.png" alt="Joinclap" className="brand-logo" />
            </Link>
            <p className="footer-tagline">ERP + CRM + Red Operativa con IA integrada</p>
            <div className="footer-social" aria-label="Redes sociales">
              <a href={CONTACTO.redes.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <FacebookIcon />
              </a>
              <a href={CONTACTO.redes.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href={CONTACTO.redes.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                <TiktokIcon />
              </a>
              <a href={CONTACTO.redes.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <YoutubeIcon />
              </a>
            </div>
          </div>

          <nav className="footer-col" aria-label="Empresa">
            <h3 className="footer-title">Empresa</h3>
            <ul className="footer-links">
              {EMPRESA_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer-col">
            <h3 className="footer-title">Contáctenos</h3>
            <ul className="footer-contact">
              <li>
                <a href={CONTACTO.telefonoHref}>
                  <PhoneIcon />
                  <span>{CONTACTO.telefono}</span>
                </a>
              </li>
              <li>
                <a href={CONTACTO.direccionHref} target="_blank" rel="noopener noreferrer">
                  <PinIcon />
                  <span>{CONTACTO.direccion}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACTO.correo}`}>
                  <MailIcon />
                  <span>{CONTACTO.correo}</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © <span id="year"></span> Joinclap. Todos los derechos reservados.
          </span>
        </div>
      </div>
    </footer>
  )
}
