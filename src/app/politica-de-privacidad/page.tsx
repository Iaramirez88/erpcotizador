import type { Metadata } from 'next'
import Link from 'next/link'

const lastUpdated = '21 de julio de 2026'

export const metadata: Metadata = {
  title: 'Política de privacidad | Ordex',
  description: 'Política de privacidad pública de la aplicación Ordex.',
  robots: {
    index: true,
    follow: true,
  },
}

const sections = [
  {
    title: '1. Responsable del tratamiento',
    body: 'Ordex es una plataforma operada por SGDigital para gestionar cotizaciones, órdenes, CRM, formularios y canales conversacionales. Esta política aplica a los datos personales tratados a través del sitio web, la aplicación y sus integraciones, incluyendo WhatsApp y formularios públicos.',
  },
  {
    title: '2. Datos que podemos recopilar',
    body: 'Podemos recopilar datos como nombre, correo electrónico, teléfono, empresa, ciudad, mensajes enviados por formularios o chatbot, datos comerciales asociados a solicitudes, y metadatos técnicos mínimos necesarios para operar la plataforma, prevenir fraude y mantener la seguridad del servicio.',
  },
  {
    title: '3. Finalidades del tratamiento',
    body: 'Usamos la información para responder solicitudes, gestionar conversaciones comerciales, generar cotizaciones y órdenes, dar soporte, operar integraciones como WhatsApp, mejorar el servicio, cumplir obligaciones legales y mantener trazabilidad operativa dentro del CRM.',
  },
  {
    title: '4. Integración con WhatsApp y Meta',
    body: 'Si te comunicas con una empresa usuaria de Ordex por WhatsApp u otros canales conectados mediante Meta, los mensajes y datos compartidos podrán ser procesados por la empresa responsable del canal y por Ordex como encargado tecnológico, exclusivamente para gestionar la conversación, el seguimiento comercial y la operación del servicio.',
  },
  {
    title: '5. Base legal y uso autorizado',
    body: 'Tratamos datos personales con fundamento en la autorización del titular, la ejecución de una relación precontractual o contractual, el interés legítimo de operación y seguridad, y las obligaciones legales aplicables según la naturaleza del servicio y la jurisdicción correspondiente.',
  },
  {
    title: '6. Compartición de información',
    body: 'La información puede compartirse con proveedores tecnológicos necesarios para la prestación del servicio, como infraestructura, autenticación, mensajería, correo, almacenamiento o análisis, así como con la empresa usuaria propietaria del canal o formulario desde el que se originó la interacción. No vendemos datos personales.',
  },
  {
    title: '7. Conservación de la información',
    body: 'Los datos se conservan durante el tiempo necesario para cumplir las finalidades del servicio, atender requerimientos legales, resolver controversias, mantener respaldos razonables y sostener el historial operativo del sistema.',
  },
  {
    title: '8. Seguridad',
    body: 'Aplicamos medidas razonables de seguridad técnicas y organizativas para reducir riesgos de acceso no autorizado, pérdida, alteración o uso indebido de la información. Sin embargo, ningún sistema conectado a Internet puede garantizar seguridad absoluta.',
  },
  {
    title: '9. Derechos de los titulares',
    body: 'Los titulares pueden solicitar acceso, actualización, corrección o supresión de sus datos, así como revocar autorizaciones cuando proceda, sujeto a las obligaciones legales y contractuales vigentes. Las solicitudes deben permitir identificar claramente al titular y el canal involucrado.',
  },
  {
    title: '10. Contacto',
    body: 'Para consultas relacionadas con privacidad, tratamiento de datos o ejercicio de derechos, puedes contactar al responsable del servicio o a la empresa propietaria del canal desde el cual se recolectó la información. Si esta instancia es operada por SGDigital, puedes usar los canales oficiales publicados por la compañía para soporte y asuntos legales.',
  },
  {
    title: '11. Cambios a esta política',
    body: 'Esta política puede actualizarse para reflejar cambios regulatorios, funcionales o de operación. La versión publicada en esta URL será la referencia vigente para efectos informativos y de cumplimiento.',
  },
] as const

export default function PoliticaDePrivacidadPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_-40px_rgba(15,23,42,0.35)]">
        <section className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.16),transparent_34%),linear-gradient(135deg,#0f172a,#1d4ed8)] px-6 py-10 text-white sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">Documento público</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Política de privacidad</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
            Esta página está disponible sin autenticación para cumplir requisitos públicos de la aplicación,
            incluyendo revisiones de integración con Meta y WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs text-white/80">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Ruta pública: /politica-de-privacidad</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5">Última actualización: {lastUpdated}</span>
          </div>
        </section>

        <section className="px-6 py-8 sm:px-10 sm:py-10">
          <div className="rounded-3xl border border-sky-100 bg-sky-50/70 px-5 py-4 text-sm leading-7 text-slate-700">
            Si Meta te solicita la URL de política de privacidad, puedes registrar la URL pública completa de esta página,
            por ejemplo: https://tu-dominio.com/politica-de-privacidad.
          </div>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <p className="text-sm leading-7 text-slate-700 sm:text-[15px]">{section.body}</p>
              </section>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3 border-t border-slate-100 pt-6">
            <Link href="/auth/login" className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
              Ir a iniciar sesión
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