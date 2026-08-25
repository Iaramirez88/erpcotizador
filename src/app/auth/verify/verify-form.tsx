"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/providers/i18n-provider"

function normalizeCallbackUrl(value: string): string {
  return value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

export default function VerifyForm({ initialEmail, callbackUrl }: { initialEmail: string; callbackUrl?: string }) {
  const { t } = useI18n()
  const router = useRouter()
  const nextCallbackUrl = normalizeCallbackUrl(callbackUrl || '/dashboard')

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [debugCode, setDebugCode] = useState<string | null>(null)

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || t('auth.verify.errors.verifyFailed'))
      }

      setMessage(t('auth.verify.success'))
      setTimeout(() => {
        const params = new URLSearchParams()
        if (nextCallbackUrl !== '/dashboard') {
          params.set('callbackUrl', nextCallbackUrl)
        }
        router.push(params.size ? `/auth/login?${params.toString()}` : "/auth/login")
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.common.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  const onResend = async () => {
    setIsResending(true)
    setError("")
    setMessage("")
    setDebugCode(null)

    try {
      const res = await fetch("/api/auth/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || t('auth.verify.errors.resendFailed'))
      }

      if (typeof data?.debugCode === "string") {
        setDebugCode(data.debugCode)
      }

      setMessage(typeof data?.message === "string" ? data.message : t('auth.verify.resent'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.common.genericError'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t('auth.verify.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.verify.description')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={onVerify}>
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
            {debugCode && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm">
                <div className="font-semibold">{t('auth.verify.devCode')}</div>
                <div className="font-mono tracking-widest text-lg">{debugCode}</div>
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
                disabled={isLoading || isResending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code" className="sr-only">{t('auth.fields.code')}</Label>
              <Input
                id="code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={isLoading}
              />
              <div className="text-xs text-muted-foreground">
                {t('auth.verify.tip')}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.verify.verifying') : t('auth.verify.submit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onResend}
              disabled={isResending || !email}
            >
              {isResending ? t('auth.verify.resending') : t('auth.verify.resend')}
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
