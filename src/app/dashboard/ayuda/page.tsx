import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AyudaPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="rounded-xl border bg-gradient-to-r from-slate-950 to-slate-900 text-slate-50 p-5">
        <h1 className="text-2xl sm:text-3xl font-bold">Ayuda</h1>
        <p className="text-slate-200 mt-1 text-sm">Accesos rápidos a secciones frecuentes y soporte básico.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Enlaces rápidos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/perfil">Mi perfil</Link>
              <div className="text-xs text-muted-foreground">Actualiza tus datos y seguridad.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/notificaciones">Notificaciones</Link>
              <div className="text-xs text-muted-foreground">Revisa eventos, alertas y estado de envíos.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/reportes">Reportes</Link>
              <div className="text-xs text-muted-foreground">Consulta indicadores y exportaciones.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/configuracion/empresa">Empresa</Link>
              <div className="text-xs text-muted-foreground">Branding, datos de la empresa y ajustes generales.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/configuracion/usuarios">Usuarios</Link>
              <div className="text-xs text-muted-foreground">Gestión de usuarios y accesos.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/configuracion/permisos">Permisos</Link>
              <div className="text-xs text-muted-foreground">Roles y permisos por módulo/sede.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
