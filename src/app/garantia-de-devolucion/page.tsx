import type { Metadata } from 'next'
import Link from 'next/link'

const lastUpdated = '25 de noviembre de 2026'

export const metadata: Metadata = {
  title: 'Garantía de devolución | Joinclap',
  description:
    'Garantía de devolución del dinero de Joinclap: plazo, condiciones, exclusiones y cómo solicitar una devolución de tu plan.',
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    title: '1. Qué es la garantía de devolución',
    body: 'Joinclap, plataforma operada por SGDigital, ofrece una garantía de devolución del dinero para que puedas probar la plataforma con confianza. Si dentro del plazo establecido consideras que Joinclap no se ajusta a las necesidades de tu empresa, puedes solicitar la devolución del importe pagado, conforme a las condiciones descritas en esta página y en nuestra política de reembolso.',
  },
  {
    title: '2. Plazo para solicitar la devolución',
    body: 'La garantía aplica durante los 14 días calendario siguientes a la fecha del primer pago de un plan de pago. La solicitud debe enviarse dentro de ese plazo y siempre antes de que finalice el periodo contratado. No se conceden devoluciones por solicitudes recibidas después del plazo indicado.',
  },
  {
    title: '3. Qué cubre la garantía',
    body: 'La garantía cubre el primer pago de los planes de suscripción de Joinclap (Básico, Medio, Intermedio y Full). Si contratas un plan anual, la devolución se calcula de forma proporcional al periodo no utilizado, tal como se detalla en la política de reembolso.',
    bullets: [
      'Primer pago de un plan mensual: se puede devolver el importe íntegro dentro del plazo de garantía.',
      'Primer pago de un plan anual: se devuelve la parte proporcional correspondiente al tiempo no consumido.',
      'La devolución se solicita una única vez por empresa o persona, sobre la primera contratación.',
    ],
  },
  {
    title: '4. Qué no cubre la garantía',
    body: 'La garantía de devolución no aplica en los siguientes casos:',
    bullets: [
      'Renovaciones o pagos posteriores de un plan ya activo.',
      'Servicios de implementación, acompañamiento u onboarding contratados por separado.',
      'Desarrollos a medida, personalizaciones o configuraciones especiales.',
      'Consumos transaccionales o de integraciones, como mensajería de WhatsApp o Meta, SMS, correo, OCR o uso de inteligencia artificial, que se facturan aparte.',
      'Cargos de terceros o comisiones de pasarelas de pago que no sean reembolsables por el proveedor.',
      'Planes adquiridos con descuentos, promociones o condiciones especiales, salvo que la normativa aplicable disponga lo contrario.',
    ],
  },
  {
    title: '5. Cómo solicitar la devolución',
    body: 'Para solicitar la devolución, escríbenos dentro del plazo a soporte@joinclap.com.co o por los canales oficiales de contacto, indicando el correo de la cuenta, el número de referencia del pago y el motivo de la solicitud. Nuestro equipo revisará la petición y confirmará si cumple las condiciones de la garantía.',
  },
  {
    title: '6. Proceso y tiempos de la devolución',
    body: 'Una vez aprobada la solicitud, procesamos la devolución al mismo método de pago utilizado en la compra. El reintegro puede tardar hasta 10 días hábiles en reflejarse, dependiendo de la entidad financiera o de la pasarela de pago. Mientras se tramita la devolución, el acceso al plan puede mantenerse activo o suspenderse según el estado de la cuenta.',
  },
  {
    title: '7. Garantía y derecho de retracto',
    body: 'Esta garantía de devolución no sustituye los derechos que la normativa aplicable otorga al consumidor, incluyendo el derecho de retracto cuando proceda. Si la ley colombiana de protección al consumidor (Ley 1480 de 2011) o cualquier otra norma aplicable establece condiciones más favorables, prevalecerá lo dispuesto en dicha norma.',
  },
  {
    title: '8. Contacto',
    body: 'Para dudas sobre la garantía de devolución puedes escribir a soporte@joinclap.com.co o usar los canales oficiales publicados por SGDigital para soporte y asuntos comerciales.',
  },
] as const

export default function GarantiaDeDevolucionPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.16),transparent_34%),linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">Documento público</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Garantía de devolución</h1>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/80">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Última actualización: {lastUpdated}</span>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="scroll-mt-24 space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="text-sm leading-7 text-slate-700 sm:text-[15px]">{section.body}</p>
                {'bullets' in section ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700 sm:text-[15px]">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link href="/politica-de-reembolso" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver política de reembolso
            </Link>
            <Link href="/terminos-de-servicio" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver términos de servicio
            </Link>
            <Link href="/" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Volver al inicio
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
