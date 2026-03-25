/**
 * Página de Login
 * 
 * Permite a los usuarios iniciar sesión con email y contraseña
 * Usa NextAuth para la autenticación
 */

"use client"

import { useEffect, useState } from "react"
import { getProviders, signIn } from "next-auth/react"
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
  const [googleEnabled, setGoogleEnabled] = useState(false)
  
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  })
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProviders() {
      try {
        const providers = await getProviders()
        if (!cancelled) {
          setGoogleEnabled(Boolean(providers?.google))
        }
      } catch {
        if (!cancelled) {
          setGoogleEnabled(false)
        }
      }
    }

    void loadProviders()

    return () => {
      cancelled = true
    }
  }, [])

  const handleGoogleSignIn = async () => {
    if (!googleEnabled) {
      setError('Google no está configurado todavía en este entorno. Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET, o el callback OAuth no coincide.')
      return
    }

    setIsLoading(true)
    setError("")
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      setError('No se pudo iniciar el acceso con Google.')
      setIsLoading(false)
    }
  }

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

            {googleEnabled ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isLoading}
                onClick={() => void handleGoogleSignIn()}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.4-.2-2H12z"/>
                  <path fill="#34A853" d="M12 22c2.6 0 4.8-.9 6.4-2.5l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.4-4H3.4v2.5A10 10 0 0 0 12 22z"/>
                  <path fill="#4A90E2" d="M6.6 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.5H3.4A10 10 0 0 0 2 12c0 1.6.4 3.1 1.4 4.5L6.6 14z"/>
                  <path fill="#FBBC05" d="M12 6c1.4 0 2.7.5 3.6 1.4l2.7-2.7C16.8 3.3 14.6 2 12 2A10 10 0 0 0 3.4 7.5L6.6 10c.8-2.3 2.9-4 5.4-4z"/>
                </svg>
                Continuar con Google
              </Button>
            ) : null}

            <div className="relative text-center text-xs text-muted-foreground">
              <span className="bg-white px-2">o entra con tu correo y contrasena</span>
              <div className="absolute inset-x-0 top-1/2 -z-10 h-px -translate-y-1/2 bg-slate-200" />
            </div>

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
