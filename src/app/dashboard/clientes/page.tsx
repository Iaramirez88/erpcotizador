/**
 * Página de Clientes
 * Lista, crea, edita y elimina clientes
 */

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ImportDialog } from "@/components/import/import-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Cliente {
  id: string
  nombre: string
  tipoDocumento: string
  documento: string
  email?: string | null
  telefono?: string | null
  celular?: string | null
  direccion?: string | null
  ciudad?: string | null
  departamento?: string | null
  createdAt: string
  _count?: {
    cotizaciones: number
  }
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    nombre: "",
    tipoDocumento: "NIT",
    documento: "",
    email: "",
    telefono: "",
    celular: "",
    direccion: "",
    ciudad: "",
    departamento: ""
  })

  // Cargar clientes
  const fetchClientes = async () => {
    setIsLoading(true)
    try {
      const url = search 
        ? `/api/clientes?search=${encodeURIComponent(search)}`
        : '/api/clientes'

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setClientes(data.data)
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchClientes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = editingCliente 
        ? `/api/clientes/${editingCliente.id}`
        : '/api/clientes'
      
      const method = editingCliente ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setIsModalOpen(false)
        resetForm()
        fetchClientes()
      } else {
        alert(data.error || 'Error al guardar cliente')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al guardar cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setFormData({
      nombre: cliente.nombre,
      tipoDocumento: cliente.tipoDocumento,
      documento: cliente.documento,
      email: cliente.email || "",
      telefono: cliente.telefono || "",
      celular: cliente.celular || "",
      direccion: cliente.direccion || "",
      ciudad: cliente.ciudad || "",
      departamento: cliente.departamento || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return

    try {
      const response = await fetch(`/api/clientes/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        fetchClientes()
      } else {
        alert(data.error || 'Error al eliminar cliente')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error al eliminar cliente')
    }
  }

  const resetForm = () => {
    setEditingCliente(null)
    setFormData({
      nombre: "",
      tipoDocumento: "NIT",
      documento: "",
      email: "",
      telefono: "",
      celular: "",
      direccion: "",
      ciudad: "",
      departamento: ""
    })
  }

  const openNewClienteModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona tu base de datos de clientes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ImportDialog module="clientes" title="Importar clientes" />
          <Button onClick={openNewClienteModal}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre, documento o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes ({clientes.length})</CardTitle>
          <CardDescription>
            Todos tus clientes registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Cargando...</p>
            </div>
          ) : clientes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No hay clientes registrados
              </p>
              <Button onClick={openNewClienteModal} className="mt-4">
                Crear primer cliente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-medium">Nombre</th>
                    <th className="pb-3 font-medium">Documento</th>
                    <th className="pb-3 font-medium">Contacto</th>
                    <th className="pb-3 font-medium">Ciudad</th>
                    <th className="pb-3 font-medium text-center">Cotizaciones</th>
                    <th className="pb-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="border-b last:border-0">
                      <td className="py-4">
                        <div>
                          <p className="font-medium">{cliente.nombre}</p>
                          <p className="text-sm text-muted-foreground">{cliente.email || 'Sin email'}</p>
                        </div>
                      </td>
                      <td className="py-4">
                        <div>
                          <p className="text-sm">{cliente.tipoDocumento}</p>
                          <p className="font-mono text-sm">{cliente.documento}</p>
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        {cliente.celular || cliente.telefono || 'Sin teléfono'}
                      </td>
                      <td className="py-4 text-sm">
                        {cliente.ciudad || '-'}
                      </td>
                      <td className="py-4 text-center">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
                          {cliente._count?.cotizaciones || 0}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(cliente)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(cliente.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de crear/editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
            </DialogTitle>
            <DialogDescription>
              {editingCliente 
                ? 'Actualiza la información del cliente'
                : 'Completa los datos del nuevo cliente'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Nombre */}
              <div className="col-span-2">
                <Label htmlFor="nombre">Nombre / Razón Social *</Label>
                <Input
                  id="nombre"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                  placeholder="Nombre del cliente"
                />
              </div>

              {/* Tipo Documento */}
              <div>
                <Label htmlFor="tipoDocumento">Tipo de Documento *</Label>
                <select
                  id="tipoDocumento"
                  value={formData.tipoDocumento}
                  onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  required
                >
                  <option value="NIT">NIT</option>
                  <option value="CC">Cédula de Ciudadanía</option>
                  <option value="CE">Cédula de Extranjería</option>
                  <option value="PASAPORTE">Pasaporte</option>
                </select>
              </div>

              {/* Documento */}
              <div>
                <Label htmlFor="documento">Número de Documento *</Label>
                <Input
                  id="documento"
                  value={formData.documento}
                  onChange={(e) => setFormData({ ...formData, documento: e.target.value })}
                  required
                  placeholder="123456789"
                />
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="cliente@empresa.com"
                />
              </div>

              {/* Teléfono */}
              <div>
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="(1) 234 5678"
                />
              </div>

              {/* Celular */}
              <div className="col-span-2">
                <Label htmlFor="celular">Celular</Label>
                <Input
                  id="celular"
                  value={formData.celular}
                  onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                  placeholder="300 123 4567"
                />
              </div>

              {/* Dirección */}
              <div className="col-span-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Calle 123 #45-67"
                />
              </div>

              {/* Ciudad */}
              <div>
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                  placeholder="Bogotá"
                />
              </div>

              {/* Departamento */}
              <div>
                <Label htmlFor="departamento">Departamento</Label>
                <Input
                  id="departamento"
                  value={formData.departamento}
                  onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                  placeholder="Cundinamarca"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting 
                  ? 'Guardando...' 
                  : editingCliente 
                    ? 'Actualizar' 
                    : 'Crear Cliente'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
