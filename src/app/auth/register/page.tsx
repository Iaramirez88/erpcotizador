/**
 * Página de Registro (Server)
 *
 * Next requiere Suspense cuando se usa useSearchParams() (en el componente cliente)
 * para evitar fallos de prerender en build (especialmente en Docker).
 */

import { Suspense } from "react"
import { RegisterPageClient } from "./register-page-client"

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      }
    >
      <RegisterPageClient />
    </Suspense>
  )
}
