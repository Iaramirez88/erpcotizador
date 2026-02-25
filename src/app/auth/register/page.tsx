/**
 * Página de Registro (Server)
 *
 * Next requiere Suspense cuando se usa useSearchParams() (en el componente cliente)
 * para evitar fallos de prerender en build (especialmente en Docker).
 */

import { Suspense } from "react"
import { RegisterPageClient } from "./register-page-client"
import { tServer } from "@/lib/i18n/server"

export default async function RegisterPage() {
  const loadingText = await tServer('common.loading')

  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md text-sm text-muted-foreground">{loadingText}</div>
      }
    >
      <RegisterPageClient />
    </Suspense>
  )
}
