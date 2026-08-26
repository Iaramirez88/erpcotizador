import { Mail, MessageCircle, Phone, Star } from 'lucide-react'
import { IdentityAvatar } from '@/components/ui/identity-avatar'
import { cn } from '@/lib/utils'

type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | null
type CoverageScope = 'LOCAL' | 'REGIONAL' | 'NATIONAL' | 'EXPORT' | null
type CapacityStatus = 'AVAILABLE' | 'LIMITED' | 'SATURATED' | 'OFFLINE' | null

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? '').replace(/\D+/g, '')
  return digits || null
}

export function buildRopWhatsAppHref(phone: string | null | undefined, companyName?: string | null) {
  const normalized = normalizePhone(phone)
  if (!normalized) return null
  const message = companyName
    ? `Hola, te contacto desde Ordex ROP por ${companyName}.`
    : 'Hola, te contacto desde Ordex ROP.'
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`
}

export function formatRopCoverageLabel(value: CoverageScope) {
  if (value === 'LOCAL') return 'Cobertura local'
  if (value === 'REGIONAL') return 'Cobertura regional'
  if (value === 'NATIONAL') return 'Cobertura nacional'
  if (value === 'EXPORT') return 'Cobertura exportación'
  return 'Cobertura por confirmar'
}

export function formatRopVerificationLabel(value: VerificationStatus) {
  if (value === 'VERIFIED') return 'Verificada'
  if (value === 'REJECTED') return 'Observada'
  if (value === 'PENDING') return 'En verificación'
  return 'Sin verificación'
}

export function getRopVerificationTone(value: VerificationStatus) {
  if (value === 'VERIFIED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export function formatRopCapacityLabel(value: CapacityStatus) {
  if (value === 'AVAILABLE') return 'Disponible'
  if (value === 'LIMITED') return 'Capacidad limitada'
  if (value === 'SATURATED') return 'Saturada'
  if (value === 'OFFLINE') return 'Fuera de servicio'
  return 'Sin snapshot'
}

export function getRopCapacityTone(value: CapacityStatus) {
  if (value === 'AVAILABLE') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (value === 'LIMITED') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'SATURATED') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (value === 'OFFLINE') return 'border-slate-300 bg-slate-100 text-slate-700'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

export function RopCompanyAvatar({
  label,
  logoUrl,
  size = 'lg',
  className,
}: {
  label: string
  logoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return <IdentityAvatar label={label} imageUrl={logoUrl} size={size} className={className} />
}

export function RopTrustStars({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return null

  const filledStars = Math.max(0, Math.min(5, Math.round(score / 20)))

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            'h-3.5 w-3.5',
            index < filledStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
          )}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-slate-500">{score}/100</span>
    </div>
  )
}

export function RopQuickContactActions({
  phone,
  email,
  companyName,
}: {
  phone?: string | null
  email?: string | null
  companyName?: string | null
}) {
  const normalizedPhone = normalizePhone(phone)
  const whatsappHref = buildRopWhatsAppHref(normalizedPhone, companyName)
  const mailHref = email ? `mailto:${email}` : null
  const callHref = normalizedPhone ? `tel:${normalizedPhone}` : null

  if (!whatsappHref && !mailHref && !callHref) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {whatsappHref ? (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      ) : null}
      {callHref ? (
        <a
          href={callHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <Phone className="h-3.5 w-3.5" /> Llamar
        </a>
      ) : null}
      {mailHref ? (
        <a
          href={mailHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
        >
          <Mail className="h-3.5 w-3.5" /> Correo
        </a>
      ) : null}
    </div>
  )
}