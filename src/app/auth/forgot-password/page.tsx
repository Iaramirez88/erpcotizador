"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/providers/i18n-provider"

export default function ForgotPasswordPage() {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [debugResetUrl, setDebugResetUrl] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")
    setDebugResetUrl(null)

    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || t('auth.forgot.errors.requestFailed'))
      }

      if (typeof data?.debugResetUrl === "string") {
        setDebugResetUrl(data.debugResetUrl)
      }

      setMessage(
        typeof data?.message === "string"
          ? data.message
          : t('auth.forgot.defaultMessage')
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.common.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t('auth.forgot.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.forgot.description')}
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {message}
              </div>
            )}
            {debugResetUrl && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm break-all">
                <div className="font-semibold">{t('auth.forgot.devLink')}</div>
                <a className="text-blue-700 underline" href={debugResetUrl}>
                  {debugResetUrl}
                </a>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">{t('auth.fields.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.placeholders.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.forgot.sending') : t('auth.forgot.submit')}
            </Button>
            <div className="text-sm text-center text-gray-600">
              <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                {t('auth.common.backToLogin')}
              </Link>
            </div>
          </CardFooter>
        </form>
    </Card>
  )
}
