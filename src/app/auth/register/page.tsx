/**
 * Página de Registro
 * 
 * Permite a nuevos usuarios crear una cuenta
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

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

export default function RegisterPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [debugCode, setDebugCode] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [empresas, setEmpresas] = useState<Array<{ id: string; nombre: string; logo?: string | null; requiresAccessCode: boolean }>>([])
  const [empresaId, setEmpresaId] = useState("")
  const [accessCode, setAccessCode] = useState("")
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/public/empresas', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: Array<{ id: string; nombre: string; logo?: string | null; requiresAccessCode: boolean }> } | null
        if (cancelled) return
        if (json?.ok && Array.isArray(json.data)) {
          setEmpresas(json.data)
          if (json.data.length === 1) {
            setEmpresaId(json.data[0]?.id ?? '')
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
  }, [])

  const selectedEmpresa = useMemo(() => empresas.find((e) => e.id === empresaId) ?? null, [empresas, empresaId])
  // Estado para validaciones en tiempo real
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    allowed: false
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

    if (empresas.length > 0 && !empresaId) {
      setError('Selecciona la entidad a la que te vas a registrar')
      setIsLoading(false)
      return
    }

    if (selectedEmpresa?.requiresAccessCode && !accessCode.trim()) {
      setError('Ingresa el código de acceso')
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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al registrar usuario")
      }

      // Registro exitoso
      setSuccess(true)

      if (typeof data?.debugCode === 'string') {
        setDebugCode(data.debugCode)
      }
      
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        router.push(`/auth/verify?email=${encodeURIComponent(formData.email)}`)
      }, 2000)

    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : "Ocurrió un error. Intenta nuevamente."
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">¡Registro exitoso!</h2>
              <p className="text-gray-600">
                Tu cuenta ha sido creada. Redirigiendo a verificación...
              </p>
              {debugCode && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm text-left">
                  <div className="font-semibold">Código (modo dev)</div>
                  <div className="font-mono tracking-widest text-lg">{debugCode}</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
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
      allowed: /^[\x21-\x7E]+$/.test(value)
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            {selectedEmpresa?.logo ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border bg-white">
                <Image src={selectedEmpresa.logo} alt={selectedEmpresa.nombre} fill className="object-contain" sizes="64px" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold">
                SG
              </div>
            )}
          </div>
          <CardTitle className="text-2xl text-center">Crear cuenta</CardTitle>
          <CardDescription className="text-center">
            Completa el formulario para crear tu cuenta
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {empresas.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="empresa">Entidad</Label>
                <select
                  id="empresa"
                  value={empresaId}
                  onChange={(e) => setEmpresaId(e.target.value)}
                  disabled={isLoading}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Selecciona…</option>
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
                {selectedEmpresa?.requiresAccessCode ? (
                  <p className="text-xs text-muted-foreground">Esta entidad requiere código de acceso.</p>
                ) : null}
              </div>
            ) : null}

            {selectedEmpresa?.requiresAccessCode ? (
              <div className="space-y-2">
                <Label htmlFor="accessCode">Código de acceso</Label>
                <Input
                  id="accessCode"
                  type="password"
                  placeholder="Código provisto por el administrador"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="off"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 8, 1 mayús, 1 minús, 1 número"
                  className="pr-10"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Validación visual en tiempo real */}
              <ul className="mt-2 text-xs text-gray-600 space-y-1">
                <li className={passwordChecks.length ? "text-green-600" : "text-red-600"}>
                  {passwordChecks.length ? "✔" : "✖"} Mínimo 8 caracteres
                </li>
                <li className={passwordChecks.uppercase ? "text-green-600" : "text-red-600"}>
                  {passwordChecks.uppercase ? "✔" : "✖"} Al menos 1 mayúscula
                </li>
                <li className={passwordChecks.lowercase ? "text-green-600" : "text-red-600"}>
                  {passwordChecks.lowercase ? "✔" : "✖"} Al menos 1 minúscula
                </li>
                <li className={passwordChecks.number ? "text-green-600" : "text-red-600"}>
                  {passwordChecks.number ? "✔" : "✖"} Al menos 1 número
                </li>
                <li className={passwordChecks.allowed ? "text-green-600" : "text-red-600"}>
                  {passwordChecks.allowed ? "✔" : "✖"} Solo caracteres visibles sin espacios
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  className="pr-10"
                  value={formData.confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Validación visual de coincidencia */}
              {formData.confirmPassword.length > 0 && (
                <div className={passwordMatch ? "text-green-600 text-xs mt-1" : "text-red-600 text-xs mt-1"}>
                  {passwordMatch ? "✔ Las contraseñas coinciden" : "✖ Las contraseñas no coinciden"}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
            <div className="text-sm text-center text-gray-600">
              ¿Ya tienes cuenta?{" "}
              <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                Inicia sesión aquí
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
