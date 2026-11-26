import type { Metadata } from 'next'
import Link from 'next/link'

const lastUpdated = '25 de noviembre de 2026'

export const metadata: Metadata = {
  title: 'Política de reembolso | Joinclap',
  description:
    'Política de reembolso de Joinclap: reglas, exclusiones, planes anuales, renovaciones y cómo se procesan los reembolsos de tu suscripción.',
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    title: '1. Regla general',
    body: 'Las suscripciones de Joinclap, plataforma operada por SGDigital, se facturan de forma anticipada y no son reembolsables de manera general una vez finalizado el periodo de garantía de devolución. Puedes cancelar tu plan en cualquier momento para evitar cargos futuros; la cancelación no genera reembolso del periodo ya facturado, salvo las excepciones descritas en esta política y en la garantía de devolución.',
  },
  {
    title: '2. Reembolsos dentro del periodo de garantía',
    body: 'Dentro de los 14 días calendario siguientes al primer pago de un plan de pago, puedes solicitar la devolución conforme a la garantía de devolución. Las solicitudes presentadas fuera de ese plazo se evalúan únicamente cuando exista una obligación legal o una causa imputable a Joinclap que justifique el reembolso.',
  },
  {
    title: '3. Renovaciones y pagos posteriores',
    body: 'Las renovaciones y los pagos posteriores de un plan activo no son reembolsables. Para no generar un cargo de renovación, debes cancelar o cambiar el plan antes de la fecha de corte correspondiente. La cancelación no elimina los datos de tu cuenta de inmediato; se aplica el calendario de conservación y eliminación descrito en la política de privacidad.',
  },
  {
    title: '4. Planes anuales',
    body: 'En los planes anuales, el reembolso solicitado dentro del periodo de garantía se calcula de forma proporcional al tiempo no utilizado, descontando el periodo ya transcurrido y el descuento por contratación anual aplicado. Fuera del periodo de garantía, el saldo no utilizado de un plan anual no es reembolsable, salvo obligación legal en contrario.',
  },
  {
    title: '5. Cargos no reembolsables',
    body: 'Los siguientes conceptos no son reembolsables en ningún caso:',
    bullets: [
      'Servicios de implementación, acompañamiento u onboarding.',
      'Desarrollos a medida, personalizaciones o configuraciones especiales.',
      'Consumos transaccionales y de integraciones: mensajería de WhatsApp o Meta, SMS, correo, OCR, uso de inteligencia artificial y servicios similares facturados por uso.',
      'Cargos de terceros, impuestos retenidos por la pasarela de pago o comisiones no devueltas por el proveedor.',
      'Planes con descuento, promociones o condiciones especiales, salvo que la normativa aplicable disponga lo contrario.',
    ],
  },
  {
    title: '6. Cómo se solicita un reembolso',
    body: 'La solicitud se envía a soporte@joinclap.com.co o por los canales oficiales de contacto, indicando el correo de la cuenta, el número de referencia del pago y el motivo. Evaluamos cada solicitud y confirmamos por escrito si procede el reembolso, su monto y el plazo estimado de reintegro.',
  },
  {
    title: '7. Método y plazos del reembolso',
    body: 'Los reembolsos aprobados se procesan al mismo método de pago utilizado en la compra. El reintegro puede tardar hasta 10 días hábiles en reflejarse según la entidad financiera o la pasarela de pago. Si el método de pago original ya no está disponible, coordinamos un medio alternativo dentro de lo permitido por la normativa aplicable.',
  },
  {
    title: '8. Cancelación y prevención de cargos',
    body: 'Puedes cancelar tu suscripción desde la configuración de tu cuenta o escribiendo a soporte. Para evitar cargos futuros, la cancelación debe realizarse antes de la fecha de corte. La cancelación no afecta el acceso al periodo ya pagado, que se mantiene hasta su vencimiento.',
  },
  {
    title: '9. Derecho de retracto y normativa aplicable',
    body: 'Esta política se aplica sin perjuicio del derecho de retracto y demás garantías que la legislación colombiana de protección al consumidor (Ley 1480 de 2011) y las normas aplicables confieren al titular. Cuando dicha normativa establezca condiciones más favorables, prevalecerá lo dispuesto por la ley.',
  },
  {
    title: '10. Contacto',
    body: 'Para dudas o solicitudes relacionadas con reembolsos, escribe a soporte@joinclap.com.co o usa los canales oficiales publicados por SGDigital para soporte y asuntos comerciales.',
  },
] as const

export default function PoliticaDeReembolsoPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.16),transparent_34%),linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">Documento público</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Política de reembolso</h1>
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
            <Link href="/garantia-de-devolucion" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver garantía de devolución
            </Link>
            <Link href="/politica-de-privacidad" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver política de privacidad
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
