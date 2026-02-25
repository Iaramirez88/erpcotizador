"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/providers/i18n-provider"

export default function ResetForm({ token }: { token: string }) {
  const { t } = useI18n()
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")

    if (!token) {
      setIsLoading(false)
      setError(t('auth.reset.errors.missingToken'))
      return
    }

    if (password !== confirmPassword) {
      setIsLoading(false)
      setError(t('auth.reset.errors.passwordMismatch'))
      return
    }

    try {
      const res = await fetch("/api/auth/password/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || t('auth.reset.errors.resetFailed'))
      }

      setMessage(t('auth.reset.success'))
      setTimeout(() => {
        router.push("/auth/login")
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('auth.common.genericError'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t('auth.reset.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.reset.description')}
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

            {!token && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm">
                {t('auth.reset.invalidLink')}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">{t('auth.fields.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('auth.reset.placeholders.newPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading || !token}
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="sr-only">{t('auth.fields.confirmPassword')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('auth.reset.placeholders.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading || !token}
                autoComplete="new-password"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading || !token}>
              {isLoading ? t('auth.reset.saving') : t('auth.reset.submit')}
            </Button>
            <div className="text-sm text-center text-gray-600">
              <Link href="/auth/forgot-password" className="text-blue-600 hover:underline font-medium">
                {t('auth.reset.backToRequestLink')}
              </Link>
            </div>
          </CardFooter>
        </form>
    </Card>
  )
}
