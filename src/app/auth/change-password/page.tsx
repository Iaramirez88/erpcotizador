/**
 * Página para cambiar contraseña
 * Permite al usuario cambiar su contraseña manualmente o generar una segura automáticamente
 */


"use client"

import Link from "next/link"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Eye, EyeOff, RefreshCw } from "lucide-react"

function generateSecurePassword(): string {
  // Genera una contraseña segura de 16 caracteres
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{};:,.<>?"
  let password = ""
  for (let i = 0; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

function getPasswordStrength(password: string): "Débil" | "Media" | "Fuerte" {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 12) score++
  if (score >= 5) return "Fuerte"
  if (score >= 3) return "Media"
  return "Débil"
}

export default function ChangePasswordPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  })
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<"Débil" | "Media" | "Fuerte">("Débil")

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, password: value })
    setPasswordStrength(getPasswordStrength(value))
    setPasswordMatch(formData.confirmPassword ? value === formData.confirmPassword : null)
  }

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData({ ...formData, confirmPassword: value })
    setPasswordMatch(formData.password ? value === formData.password : null)
  }

  const handleGeneratePassword = () => {
    const generated = generateSecurePassword()
    setFormData({ ...formData, password: generated, confirmPassword: generated })
    setPasswordStrength(getPasswordStrength(generated))
    setPasswordMatch(true)
  }

  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Aquí iría la lógica para enviar la nueva contraseña al backend
    setSuccess(true)
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
              <h2 className="text-2xl font-bold text-gray-900">¡Contraseña cambiada!</h2>
              <p className="text-gray-600">
                Tu contraseña se actualizó correctamente.
              </p>
              <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">Volver al dashboard</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Cambiar contraseña</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nueva contraseña"
                  className="pr-10"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                  aria-label="Generar contraseña segura"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 text-xs">
                Nivel de seguridad: <span className={passwordStrength === "Fuerte" ? "text-green-600" : passwordStrength === "Media" ? "text-yellow-600" : "text-red-600"}>{passwordStrength}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repite la nueva contraseña"
                  className="pr-10"
                  value={formData.confirmPassword}
                  onChange={handleConfirmPasswordChange}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.confirmPassword.length > 0 && (
                <div className={passwordMatch ? "text-green-600 text-xs mt-1" : "text-red-600 text-xs mt-1"}>
                  {passwordMatch ? "✔ Las contraseñas coinciden" : "✖ Las contraseñas no coinciden"}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">Cambiar contraseña</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
