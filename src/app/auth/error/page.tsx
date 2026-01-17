import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  const error = typeof searchParams?.error === "string" ? searchParams.error : null

  const message =
    error === "CredentialsSignin"
      ? "No se pudo iniciar sesión. Verifica tus credenciales."
      : error === "EMAIL_NOT_VERIFIED"
        ? "Tu cuenta no está verificada."
        : error
          ? `Error de autenticación: ${error}`
          : "Ocurrió un error de autenticación."

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Error</CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
            Volver al login
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
