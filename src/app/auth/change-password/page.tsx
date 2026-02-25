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
import { useI18n } from "@/components/providers/i18n-provider"

function generateSecurePassword(): string {
  // Genera una contraseña segura de 16 caracteres
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{};:,.<>?"
  let password = ""
  for (let i = 0; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

type PasswordStrength = 'weak' | 'medium' | 'strong'

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (password.length >= 12) score++
  if (score >= 5) return 'strong'
  if (score >= 3) return 'medium'
  return 'weak'
}

export default function ChangePasswordPage() {
  const { t } = useI18n()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  })
  const [passwordMatch, setPasswordMatch] = useState<boolean | null>(null)
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>('weak')

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
      <Card className="w-full max-w-md border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('auth.changePassword.successTitle')}</h2>
              <p className="text-gray-600">
                {t('auth.changePassword.successDescription')}
              </p>
              <Link href="/dashboard" className="text-blue-600 hover:underline font-medium">{t('auth.changePassword.backToDashboard')}</Link>
            </div>
          </CardContent>
      </Card>
    )
  }
  return (
    <Card className="w-full max-w-md border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t('auth.changePassword.title')}</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">{t('auth.changePassword.fields.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t('auth.changePassword.placeholders.newPassword')}
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
                  aria-label={showPassword ? t('auth.password.hide') : t('auth.password.show')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800"
                  aria-label={t('auth.changePassword.generate')}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 text-xs">
                {t('auth.changePassword.strengthLabel')}{' '}
                <span
                  className={
                    passwordStrength === 'strong'
                      ? 'text-green-600'
                      : passwordStrength === 'medium'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }
                >
                  {passwordStrength === 'strong'
                    ? t('auth.passwordStrength.strong')
                    : passwordStrength === 'medium'
                      ? t('auth.passwordStrength.medium')
                      : t('auth.passwordStrength.weak')}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="sr-only">{t('auth.changePassword.fields.confirmNewPassword')}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder={t('auth.changePassword.placeholders.confirmNewPassword')}
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
                  aria-label={showConfirmPassword ? t('auth.confirmation.hide') : t('auth.confirmation.show')}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formData.confirmPassword.length > 0 && (
                <div className={passwordMatch ? "text-green-600 text-xs mt-1" : "text-red-600 text-xs mt-1"}>
                  {passwordMatch ? t('auth.common.passwordsMatch') : t('auth.common.passwordsDoNotMatch')}
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">{t('auth.changePassword.submit')}</Button>
          </CardFooter>
        </form>
    </Card>
  )
}
