import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { tServer } from "@/lib/i18n/server"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams?: { error?: string }
}) {
  const error = typeof searchParams?.error === "string" ? searchParams.error : null

  let message: string
  if (error === "CredentialsSignin") {
    message = await tServer('auth.error.credentials')
  } else if (error === "EMAIL_NOT_VERIFIED") {
    message = await tServer('auth.error.emailNotVerified')
  } else if (error) {
    message = `${await tServer('auth.error.prefix')}${error}`
  } else {
    message = await tServer('auth.error.generic')
  }

  const title = await tServer('auth.error.title')
  const backToLogin = await tServer('auth.common.backToLogin')

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{title}</CardTitle>
          <CardDescription className="text-center">{message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
            {backToLogin}
          </Link>
        </CardContent>
    </Card>
  )
}
