'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff } from 'lucide-react'

type EmpresaConfig = {
  empresaId: string
  workspaceCode: string
  nombre: string
  nit: string
  logo: string | null
  hasRegistrationCode: boolean
}

export default function ConfigEmpresaPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [config, setConfig] = useState<EmpresaConfig | null>(null)
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [registrationCode, setRegistrationCode] = useState('')
  const [showRegistrationCode, setShowRegistrationCode] = useState(false)

  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [companyEmail, setCompanyEmail] = useState('')

  const logoPreview = useMemo(() => (logo ?? config?.logo ?? null), [logo, config?.logo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/configuracion/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
        if (cancelled) return
        if (!res.ok || !json?.ok || !json.data) {
          setError(json?.error ?? 'No se pudo cargar la configuración.')
          return
        }
        setConfig(json.data)
        setNombre(json.data.nombre)
        setNit(json.data.nit)
        setLogo(json.data.logo)
      } catch {
        if (!cancelled) setError('No se pudo cargar la configuración.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveBranding() {
    if (!config) return
    const nextNombre = nombre.trim()
    const nextNit = nit.trim()
    if (!nextNombre) {
      setError('El nombre no puede estar vacío.')
      return
    }
    if (!nextNit) {
      setError('El NIT no puede estar vacío.')
      return
    }

    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nextNombre, nit: nextNit, logo }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setError(json?.error ?? 'No se pudo guardar.')
        return
      }
      setConfig(json.data)
      setStatus('Guardado.')

      window.dispatchEvent(
        new CustomEvent('empresa:branding-updated', {
          detail: { nombre: json.data.nombre, logo: json.data.logo, nit: json.data.nit },
        })
      )
    } finally {
      setSaving(false)
    }
  }

  async function saveRegistrationCode() {
    if (!config) return
    const code = registrationCode.trim()
    if (!code) {
      setError('Ingresa un código válido.')
      return
    }

    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationCode: code }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setError(json?.error ?? 'No se pudo guardar.')
        return
      }
      setConfig(json.data)
      setRegistrationCode('')
      setStatus('Código actualizado.')
    } finally {
      setSaving(false)
    }
  }

  async function clearRegistrationCode() {
    if (!config) return
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch('/api/configuracion/empresa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationCode: null }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: EmpresaConfig; error?: string } | null
      if (!res.ok || !json?.ok || !json.data) {
        setError(json?.error ?? 'No se pudo guardar.')
        return
      }
      setConfig(json.data)
      setStatus('Código eliminado.')
    } finally {
      setSaving(false)
    }
  }

  async function generateCompanyCode() {
    if (!config) return
    setSaving(true)
    setError(null)
    setStatus(null)
    setCompanyCode(null)
    try {
      const res = await fetch('/api/configuracion/empresa/company-code', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string; error?: string } | null
      if (!res.ok || !json?.ok || !json.code) {
        setError(json?.error ?? 'No se pudo generar el código.')
        return
      }
      setCompanyCode(json.code)
      setStatus('Código generado.')
    } finally {
      setSaving(false)
    }
  }

  async function sendCompanyCodeEmail() {
    if (!config) return
    const email = companyEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      setError('Email inválido.')
      return
    }

    setSaving(true)
    setError(null)
    setStatus(null)
    setCompanyCode(null)
    try {
      const res = await fetch('/api/configuracion/empresa/company-code/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; debugCode?: string } | null
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? 'No se pudo enviar el correo.')
        return
      }

      if (typeof json?.debugCode === 'string') {
        setCompanyCode(json.debugCode)
      }

      setCompanyEmail('')
      setStatus('Correo enviado.')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoFile(file: File) {
    const maxBytes = 400 * 1024
    if (file.size > maxBytes) {
      setError('Logo demasiado grande (máx 400KB).')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Formato no soportado. Usa PNG/JPG/WebP.')
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsDataURL(file)
    })

    setLogo(dataUrl)
    setError(null)
    setStatus(null)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Empresa</h1>
        <p className="text-muted-foreground">Personaliza nombre, logo y el ID de empresa para registros.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Este nombre y logo se usan en pantallas públicas y el dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? <p className="text-sm text-muted-foreground">Cargando…</p> : null}
          {error ? <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">{error}</div> : null}
          {status ? <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">{status}</div> : null}

          {config ? (
            <>
              <div className="space-y-2">
                <Label>Código de espacio de trabajo</Label>
                <Input value={config.workspaceCode} readOnly disabled className="font-mono" />
                <p className="text-xs text-muted-foreground">
                  Comparte este código para identificar el espacio de trabajo y solicitar acceso.
                </p>
              </div>

              <div className="space-y-2">
                <Label>ID interno (técnico)</Label>
                <Input value={config.empresaId} readOnly disabled className="font-mono" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={saving} />
                </div>
                <div className="space-y-2">
                  <Label>NIT</Label>
                  <Input value={nit} onChange={(e) => setNit(e.target.value)} disabled={saving} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="relative h-14 w-14 rounded-md overflow-hidden border bg-white">
                    {logoPreview ? (
                      <Image src={logoPreview} alt="Logo" fill className="object-contain" sizes="56px" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">Sin logo</div>
                    )}
                  </div>
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={saving}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      void handleLogoFile(file)
                      e.currentTarget.value = ''
                    }}
                    className="max-w-sm"
                  />
                  <Button type="button" variant="outline" disabled={saving || !logoPreview} onClick={() => setLogo(null)}>
                    Quitar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Recomendado: 512×512. Máx 400KB.</p>
              </div>
            </>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="button" disabled={saving || loading || !config} onClick={() => void saveBranding()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ID de empresa (registro)</CardTitle>
          <CardDescription>
            Si está activo, cualquier usuario nuevo deberá ingresar el ID de empresa (EMP-...) para crear cuenta en esta entidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {config ? (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm">
                  Estado: <span className={config.hasRegistrationCode ? 'text-green-700 font-medium' : 'text-muted-foreground'}>
                    {config.hasRegistrationCode ? 'Activo' : 'Inactivo'}
                  </span>
                </p>
                <Button type="button" variant="outline" disabled={saving || !config.hasRegistrationCode} onClick={() => void clearRegistrationCode()}>
                  Eliminar código
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Nuevo código</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type={showRegistrationCode ? 'text' : 'password'}
                    placeholder="Define un ID (recomendado: formato EMP-...)"
                    value={registrationCode}
                    onChange={(e) => setRegistrationCode(e.target.value)}
                    disabled={saving}
                    className="max-w-sm"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setShowRegistrationCode((v) => !v)}
                    aria-label={showRegistrationCode ? 'Ocultar código' : 'Mostrar código'}
                  >
                    {showRegistrationCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button type="button" disabled={saving} onClick={() => void saveRegistrationCode()}>
                    {saving ? 'Guardando…' : 'Actualizar código'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Puedes previsualizar lo que escribes. El código actual no se puede recuperar por seguridad.</p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ID de empresa (unirse / registrar)</CardTitle>
          <CardDescription>
            Úsalo para que usuarios existentes puedan unirse al espacio o para registrar nuevos usuarios si el acceso está habilitado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="button" variant="outline" disabled={saving || loading || !config} onClick={() => void generateCompanyCode()}>
              Generar ID
            </Button>
            {companyCode ? (
              <div className="text-sm">
                <span className="text-muted-foreground">ID de empresa: </span>
                <span className="font-mono">{companyCode}</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">El código se muestra solo al generarlo o en modo dev.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Enviar por email</Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                value={companyEmail}
                onChange={(e) => setCompanyEmail(e.target.value)}
                placeholder="usuario@correo.com"
                disabled={saving || loading}
                className="max-w-sm"
              />
              <Button type="button" disabled={saving || loading || !companyEmail.trim()} onClick={() => void sendCompanyCodeEmail()}>
                Enviar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Por seguridad, al enviar se genera un nuevo código (rota el anterior).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
