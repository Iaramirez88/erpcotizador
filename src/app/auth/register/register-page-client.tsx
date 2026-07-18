/**
 * Página de Registro (Client)
 *
 * Se separa en componente cliente para poder usar useSearchParams()
 * envuelto en Suspense desde page.tsx (requerido por Next en build).
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useI18n } from "@/components/providers/i18n-provider"

function isWorkspaceCode(code: string): boolean {
  const raw = code.trim()
  if (!raw) return false
  const up = raw.toUpperCase()
  return /^WS-[A-Z0-9]+$/i.test(up)
}

function validatePassword(password: string, t: (key: string) => string): string | null {
  if (password.length < 8) return t('auth.register.passwordErrors.minLength')
  if (!/[A-Z]/.test(password)) return t('auth.register.passwordErrors.uppercase')
  if (!/[a-z]/.test(password)) return t('auth.register.passwordErrors.lowercase')
  if (!/[0-9]/.test(password)) return t('auth.register.passwordErrors.number')
  // Caracteres permitidos: ASCII visibles sin espacios ("!" a "~")
  if (!/^[\x21-\x7E]+$/.test(password)) {
    return t('auth.register.passwordErrors.allowed')
  }
  return null
}

export function RegisterPageClient() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [registerMode, setRegisterMode] = useState<'individual' | 'empresa'>('individual')

  const [empresaIdInput, setEmpresaIdInput] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [invitedSedeId, setInvitedSedeId] = useState<string | null>(null)
  const [lockedEmail, setLockedEmail] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (cancelled) return

      const empresaIdFromUrl = (searchParams?.get('empresaId') ?? '').trim()
      const sedeIdFromUrl = (searchParams?.get('sedeId') ?? '').trim()
      const emailFromUrl = (searchParams?.get('email') ?? '').trim().toLowerCase()
      const accessCodeFromUrl = (searchParams?.get('accessCode') ?? searchParams?.get('code') ?? '').trim()

      if (empresaIdFromUrl) {
        setEmpresaIdInput(empresaIdFromUrl)
        setRegisterMode('empresa')
      }

      if (accessCodeFromUrl) {
        setAccessCode(accessCodeFromUrl)
      }

      if (emailFromUrl && emailFromUrl.includes("@")) {
        setFormData((p) => ({ ...p, email: emailFromUrl }))
        setLockedEmail(emailFromUrl)
      }

      if (sedeIdFromUrl) {
        setInvitedSedeId(sedeIdFromUrl)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const empresaHelperText = useMemo(() => {
    if (!empresaIdInput.trim()) return t('auth.register.empresaHelp.empty')
    if (isWorkspaceCode(empresaIdInput)) return t('auth.register.empresaHelp.parsed')
    return t('auth.register.empresaHelp.hint')
  }, [empresaIdInput, t])

  // Estado para validaciones en tiempo real
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    allowed: false,
  })
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const isEmpresa = registerMode === 'empresa'
    if (isEmpresa && !empresaIdInput.trim()) {
      setError(t('auth.register.errors.missingEmpresaId'))
      setIsLoading(false)
      return
    }

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.common.passwordsDoNotMatch'))
      setIsLoading(false)
      return
    }

    const passwordError = validatePassword(formData.password, t)
    if (passwordError) {
      setError(passwordError)
      setIsLoading(false)
      return
    }

    try {
      // Llamar a la API de registro
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          empresaId: isEmpresa ? empresaIdInput.trim() : undefined,
          accessCode: isEmpresa ? accessCode.trim() : undefined,
          sedeId: invitedSedeId || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || t('auth.register.errors.registerFailed'))
      }

      // Registro exitoso
      setSuccess(true)

      if (typeof data?.debugCode === "string") {
        setDebugCode(data.debugCode)
      }

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push(`/auth/verify?email=${encodeURIComponent(formData.email)}`)
      }, 2000)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('auth.common.tryAgain')
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md border-0 shadow-sm">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t('auth.register.successTitle')}</h2>
            <p className="text-gray-600">{t('auth.register.successDescription')}</p>
            {debugCode && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm text-left">
                <div className="font-semibold">{t('auth.register.devCode')}</div>
                <div className="font-mono tracking-widest text-lg">{debugCode}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Validación en tiempo real de la contraseña
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, password: value })
    setPasswordChecks({
      length: value.length >= 8,
      uppercase: /[A-Z]/.test(value),
      lowercase: /[a-z]/.test(value),
      number: /[0-9]/.test(value),
      allowed: /^[\x21-\x7E]+$/.test(value),
    })
    setPasswordMatch(formData.confirmPassword ? value === formData.confirmPassword : null)
  }

  // Validación en tiempo real de la confirmación
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, confirmPassword: value })
    setPasswordMatch(formData.password ? value === formData.password : null)
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-2">
            <div className="text-3xl font-semibold tracking-tight">Ordex</div>
          </div>
          <CardTitle className="text-2xl text-center">{t('auth.register.title')}</CardTitle>
          <CardDescription className="text-center">{t('auth.register.description')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div>
            )}

            <Tabs value={registerMode} onValueChange={(v) => setRegisterMode(v as 'individual' | 'empresa')} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="individual">{t('auth.register.tabs.individual')}</TabsTrigger>
                <TabsTrigger value="empresa">{t('auth.register.tabs.empresa')}</TabsTrigger>
              </TabsList>

              <TabsContent value="individual">
                {registerMode === 'individual' ? (
                  <p className="text-xs text-muted-foreground">
                    {t('auth.register.individualHelp')}
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="empresa">
                {registerMode === 'empresa' ? (
                  <div className="space-y-2">
                    <Label htmlFor="empresaId" className="sr-only">ID de empresa</Label>
                    <Input
                      id="empresaId"
                      value={empresaIdInput}
                      onChange={(e) => setEmpresaIdInput(e.target.value)}
                      placeholder={t('auth.register.placeholders.empresaId')}
                      disabled={isLoading}
                      required={registerMode === 'empresa'}
                    />
                    <p className="text-xs text-muted-foreground">{empresaHelperText}</p>

                    <Label htmlFor="accessCode" className="sr-only">Código de acceso</Label>
                    <Input
                      id="accessCode"
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder={t('auth.register.placeholders.accessCode')}
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">{t('auth.register.accessCodeHelp')}</p>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="name" className="sr-only">{t('auth.fields.name')}</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('auth.placeholders.name')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">{t('auth.fields.email')}</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder={t('auth.placeholders.email')}
                disabled={isLoading || Boolean(lockedEmail)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">{t('auth.fields.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handlePasswordChange}
                  placeholder={t('auth.placeholders.password')}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• {t('auth.register.passwordRules.minLength')}: {passwordChecks.length ? "OK" : "—"}</div>
                <div>• {t('auth.register.passwordRules.uppercase')}: {passwordChecks.uppercase ? "OK" : "—"}</div>
                <div>• {t('auth.register.passwordRules.lowercase')}: {passwordChecks.lowercase ? "OK" : "—"}</div>
                <div>• {t('auth.register.passwordRules.number')}: {passwordChecks.number ? "OK" : "—"}</div>
                <div>• {t('auth.register.passwordRules.noSpaces')}: {passwordChecks.allowed ? "OK" : "—"}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="sr-only">{t('auth.fields.confirmPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder={t('auth.placeholders.confirmPassword')}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? t('auth.confirmation.hide') : t('auth.confirmation.show')}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordMatch !== null ? (
                <p className={`text-xs ${passwordMatch ? "text-green-600" : "text-red-600"}`}>
                  {passwordMatch ? t('auth.common.passwordsMatch') : t('auth.common.passwordsDoNotMatch')}
                </p>
              ) : null}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('auth.register.creating') : t('auth.register.submit')}
            </Button>

            <p className="text-sm text-muted-foreground">
              {t('auth.register.haveAccount')}{" "}
              <Link href="/auth/login" className="underline">
                {t('auth.register.signIn')}
              </Link>
            </p>
          </CardFooter>
        </form>
    </Card>
  )
}
