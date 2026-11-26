import type { Metadata } from 'next'
import Link from 'next/link'

const lastUpdated = '20 de noviembre de 2026'

export const metadata: Metadata = {
  title: 'Términos de servicio | Joinclap',
  description: 'Términos de servicio públicos de la aplicación Joinclap.',
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    title: '1. Aceptación de los términos',
    body: 'Al acceder o utilizar Joinclap aceptas estos términos de servicio y nuestra política de privacidad. Si no estás de acuerdo con alguno de estos términos, no debes utilizar la plataforma. El uso de Joinclap por parte de una empresa implica que la persona que crea el espacio de trabajo tiene autorización para aceptar estos términos en su nombre.',
  },
  {
    title: '2. Descripción del servicio',
    body: 'Joinclap es una plataforma de gestión empresarial que integra cotizaciones, órdenes, facturación, CRM omnicanal, formularios, chatbot, agenda y canales conversacionales como WhatsApp, Messenger, Instagram y TikTok. El servicio se presta bajo el modelo de suscripción y se entrega como herramienta de gestión, no como asesoría legal, contable o financiera.',
  },
  {
    title: '3. Cuentas y seguridad de acceso',
    body: 'Cada empresa usuaria es responsable de mantener la confidencialidad de sus credenciales de acceso y de las credenciales de las integraciones que conecte. Debes notificar de inmediato cualquier uso no autorizado. Joinclap puede suspender accesos que comprometan la seguridad o la integridad del servicio.',
  },
  {
    title: '4. Uso permitido',
    body: 'Te comprometes a utilizar Joinclap exclusivamente para fines lícitos y conforme a la normativa aplicable. Está prohibido usar la plataforma para enviar contenido no solicitado (spam), contenido fraudulento, discriminatorio o que infrinja derechos de terceros, así como intentar acceder a datos de otras empresas o usuarios.',
  },
  {
    title: '5. Planes, facturación y vigencia',
    body: 'El acceso a Joinclap está sujeto al plan contratado y a su vigencia. Al vencerse el plan sin renovación, el servicio podrá suspenderse y la información eliminarse conforme a lo descrito en la política de privacidad. Las condiciones de precio, periodo y renovación se informan en el proceso de contratación.',
  },
  {
    title: '6. Propiedad intelectual',
    body: 'Joinclap, su interfaz, su marca y su código son propiedad de SGDigital o de sus licenciantes. Los datos que cada empresa introduce en la plataforma pertenecen a dicha empresa. Al usar la plataforma no adquieres derechos de propiedad sobre el software, salvo la licencia de uso limitada que otorgan estos términos.',
  },
  {
    title: '7. Integraciones con terceros',
    body: 'Joinclap puede conectarse a servicios de terceros como WhatsApp, Messenger, Instagram, TikTok, Gmail, Outlook y Google Sheets. El uso de estas integraciones está sujeto además a los términos de dichos proveedores. La empresa usuaria es responsable de conectar únicamente cuentas y activos que esté autorizada a gestionar.',
  },
  {
    title: '8. Limitación de responsabilidad',
    body: 'Joinclap se presta bajo un modelo de disponibilidad razonable, sin garantías de funcionamiento ininterrumpido. En la medida permitida por la ley, SGDigital no será responsable por daños indirectos, pérdida de datos o lucro cesante derivados del uso o de la imposibilidad de uso de la plataforma.',
  },
  {
    title: '9. Suspensión y terminación',
    body: 'Joinclap puede suspender o terminar una cuenta por incumplimiento de estos términos, por falta de pago o por uso indebido del servicio. La empresa usuaria puede dejar de usar la plataforma en cualquier momento, sujeto a las condiciones de cancelación del plan contratado.',
  },
  {
    title: '10. Cambios a estos términos',
    body: 'Estos términos pueden actualizarse para reflejar cambios funcionales, regulatorios o comerciales. La versión publicada en esta URL será la referencia vigente.',
  },
  {
    title: '11. Contacto',
    body: 'Para consultas sobre estos términos puedes usar los canales oficiales de soporte publicados por SGDigital, o la empresa responsable del servicio desde el cual se originó tu cuenta.',
  },
] as const
export default function TerminosDeServicioPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.16),transparent_34%),linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">Documento público</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Términos de servicio</h1>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/80">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Última actualización: {lastUpdated}</span>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="text-sm leading-7 text-slate-700 sm:text-[15px]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link href="/politica-de-privacidad" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver política de privacidad
            </Link>
            <Link href="/plataforma" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ver plataforma
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
