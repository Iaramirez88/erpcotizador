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

function validatePassword(password: string): string | null {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres"
  if (!/[A-Z]/.test(password)) return "La contraseña debe incluir al menos 1 mayúscula"
  if (!/[a-z]/.test(password)) return "La contraseña debe incluir al menos 1 minúscula"
  if (!/[0-9]/.test(password)) return "La contraseña debe incluir al menos 1 número"
  // Caracteres permitidos: ASCII visibles sin espacios ("!" a "~")
  if (!/^[\x21-\x7E]+$/.test(password)) {
    return "La contraseña solo puede contener caracteres visibles sin espacios"
  }
  return null
}

export function RegisterPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [empresas, setEmpresas] = useState<
    Array<{ id: string; nombre: string; logo?: string | null; requiresAccessCode: boolean }>
  >([])
  const [empresaId, setEmpresaId] = useState("")
  const [invitedSedeId, setInvitedSedeId] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState("")
  const [lockedEmpresaId, setLockedEmpresaId] = useState<string | null>(null)
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
      try {
        const res = await fetch("/api/public/empresas", { cache: "no-store" })
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean
          data?: Array<{ id: string; nombre: string; logo?: string | null; requiresAccessCode: boolean }>
        } | null
        if (cancelled) return
        if (json?.ok && Array.isArray(json.data)) {
          setEmpresas(json.data)
          const empresaIdFromUrl = (searchParams.get("empresaId") ?? "").trim()
          const sedeIdFromUrl = (searchParams.get("sedeId") ?? "").trim()
          const emailFromUrl = (searchParams.get("email") ?? "").trim().toLowerCase()

          if (empresaIdFromUrl) {
            setEmpresaId(empresaIdFromUrl)
            setLockedEmpresaId(empresaIdFromUrl)
          } else {
            // Por defecto: espacio personal (empresaId vacío)
            setEmpresaId("")
          }

          if (emailFromUrl && emailFromUrl.includes("@")) {
            setFormData((p) => ({ ...p, email: emailFromUrl }))
            setLockedEmail(emailFromUrl)
          }

          if (sedeIdFromUrl) {
            setInvitedSedeId(sedeIdFromUrl)
          }
        }
      } catch {
        // ignore
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const selectedEmpresa = useMemo(() => empresas.find((e) => e.id === empresaId) ?? null, [empresas, empresaId])

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

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden")
      setIsLoading(false)
      return
    }

    const passwordError = validatePassword(formData.password)
    if (passwordError) {
      setError(passwordError)
      setIsLoading(false)
      return
    }

    if (selectedEmpresa?.requiresAccessCode && !accessCode.trim()) {
      setError("Ingresa el código de acceso")
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
          empresaId: empresaId || undefined,
          accessCode: accessCode || undefined,
          sedeId: invitedSedeId || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar usuario")
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
      const message = error instanceof Error ? error.message : "Ocurrió un error. Intenta nuevamente."
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
            <h2 className="text-2xl font-bold text-gray-900">¡Registro exitoso!</h2>
            <p className="text-gray-600">Tu cuenta ha sido creada. Redirigiendo a verificación...</p>
            {debugCode && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm text-left">
                <div className="font-semibold">Código (modo dev)</div>
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
          <CardTitle className="text-2xl text-center">Crear cuenta</CardTitle>
          <CardDescription className="text-center">Completa el formulario para crear tu cuenta</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div>
            )}

            {empresas.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="empresa" className="sr-only">Espacio</Label>
                <select
                  id="empresa"
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  disabled={isLoading || Boolean(lockedEmpresaId)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Mi espacio personal (requiere plan básico)</option>
                  <optgroup label="Empresas">
                    {empresas.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-xs text-muted-foreground">
                  Tu información se guarda separada por empresa. Si eliges “Mi espacio personal”, trabajas en un entorno solo para tu cuenta.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="name" className="sr-only">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nombre"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="tu@email.com"
                disabled={isLoading || Boolean(lockedEmail)}
                required
              />
            </div>

            {selectedEmpresa?.requiresAccessCode ? (
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="sr-only">Código de acceso</Label>
                <Input
                  id="accessCode"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Código de acceso"
                  required
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handlePasswordChange}
                  placeholder="Contraseña"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• Mínimo 8 caracteres: {passwordChecks.length ? "OK" : "—"}</div>
                <div>• 1 mayúscula: {passwordChecks.uppercase ? "OK" : "—"}</div>
                <div>• 1 minúscula: {passwordChecks.lowercase ? "OK" : "—"}</div>
                <div>• 1 número: {passwordChecks.number ? "OK" : "—"}</div>
                <div>• Sin espacios: {passwordChecks.allowed ? "OK" : "—"}</div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="sr-only">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  placeholder="Confirmar contraseña"
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordMatch !== null ? (
                <p className={`text-xs ${passwordMatch ? "text-green-600" : "text-red-600"}`}>
                  {passwordMatch ? "Las contraseñas coinciden" : "Las contraseñas no coinciden"}
                </p>
              ) : null}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creando..." : "Crear cuenta"}
            </Button>

            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/auth/login" className="underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
    </Card>
  )
}
