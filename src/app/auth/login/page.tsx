/**
 * Página de Login
 * 
 * Permite a los usuarios iniciar sesión con email y contraseña
 * Usa NextAuth para la autenticación
 */

"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff } from "lucide-react"
import { useI18n } from "@/components/providers/i18n-provider"

export default function LoginPage() {
  const { t } = useI18n()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsVerification, setNeedsVerification] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setNeedsVerification(false)

    try {
      // Intentar iniciar sesión con NextAuth
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        remember: rememberMe ? 'true' : 'false',
        redirect: false,
      })

      if (result?.error) {
        if (result.error === 'EMAIL_NOT_VERIFIED') {
          setNeedsVerification(true)
          setError(t('auth.login.errors.emailNotVerified'))
        } else {
          setError(t('auth.login.errors.invalidCredentials'))
        }
        return
      }

      // Si el login fue exitoso, redirigir al dashboard
      router.push("/dashboard")
      router.refresh()
    } catch {
      setError(t('auth.login.errors.generic'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="text-3xl font-semibold tracking-tight">Ordex</div>
          </div>
          <CardTitle className="text-2xl text-center">{t('auth.login.title')}</CardTitle>
          <CardDescription className="text-center">
            {t('auth.login.description')}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
                {needsVerification && (
                  <div className="mt-2">
                    <Link
                      href={`/auth/verify?email=${encodeURIComponent(formData.email)}`}
                      className="text-blue-600 hover:underline"
                    >
                      {t('auth.login.verifyAccount')}
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">{t('auth.fields.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.placeholders.email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">{t('auth.fields.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <Link 
                href="/auth/forgot-password" 
                className="text-blue-600 hover:underline"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              {t('auth.login.rememberMe')}
            </label>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? t('auth.login.signingIn') : t('auth.login.submit')}
            </Button>

            <div className="text-sm text-center text-gray-600">
              {t('auth.login.noAccount')}{" "}
              <Link href="/auth/register" className="text-blue-600 hover:underline font-medium">
                {t('auth.login.registerHere')}
              </Link>
            </div>
          </CardFooter>
        </form>
    </Card>
  )
}
