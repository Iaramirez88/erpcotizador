'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ImportDialog } from '@/components/import/import-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Proveedor = {
  id: string
  nombre: string
  nit: string | null
  telefono: string | null
  direccion: string | null
  email: string | null
  contacto: string | null
  ciudad: string | null
  departamento: string | null
  observaciones: string | null
  activo: boolean
  createdAt: string
}

export default function ProveedoresPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Proveedor[]>([])

  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [email, setEmail] = useState('')
  const [contacto, setContacto] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [observaciones, setObservaciones] = useState('')

  const query = useMemo(() => search.trim(), [search])

  async function load() {
    setLoading(true)
    try {
      const url = new URL('/api/proveedores', window.location.origin)
      if (query) url.searchParams.set('search', query)
      const res = await fetch(url.toString())
      const json = await res.json().catch(() => null)
      setItems(json?.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  async function create() {
    if (!nombre.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          nit: nit.trim() || null,
          telefono: telefono.trim() || null,
          direccion: direccion.trim() || null,
          email: email.trim() || null,
          contacto: contacto.trim() || null,
          ciudad: ciudad.trim() || null,
          departamento: departamento.trim() || null,
          observaciones: observaciones.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error ?? 'No se pudo crear')
      }

      setNombre('')
      setNit('')
      setTelefono('')
      setDireccion('')
      setEmail('')
      setContacto('')
      setCiudad('')
      setDepartamento('')
      setObservaciones('')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Proveedores</h1>
          <p className="text-muted-foreground mt-1">Maestro de proveedores (NIT, contacto, dirección).</p>
        </div>
        <ImportDialog module="proveedores" title="Importar proveedores" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear proveedor</CardTitle>
          <CardDescription>Campos mínimos para compras y reportes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Proveedor S.A.S" />
            </div>
            <div className="space-y-2">
              <Label>NIT</Label>
              <Input value={nit} onChange={(e) => setNit(e.target.value)} placeholder="900123456-7" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3001234567" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="compras@proveedor.com" />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Nombre contacto" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Medellín" />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Antioquia" />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label>Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle 123 #45-67" />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Notas internas..." />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={create} disabled={saving || !nombre.trim()}>
              {saving ? 'Guardando...' : 'Crear proveedor'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Listado</CardTitle>
              <CardDescription>Busca por nombre, NIT, teléfono o email.</CardDescription>
            </div>
            <div className="w-full max-w-md">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Nombre</th>
                  <th className="py-2 text-left">NIT</th>
                  <th className="py-2 text-left">Teléfono</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Dirección</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.nombre}</td>
                    <td className="py-2">{p.nit ?? '—'}</td>
                    <td className="py-2">{p.telefono ?? '—'}</td>
                    <td className="py-2">{p.email ?? '—'}</td>
                    <td className="py-2">{p.direccion ?? '—'}</td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      Sin resultados
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
