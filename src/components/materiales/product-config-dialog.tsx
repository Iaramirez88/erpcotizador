"use client"

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type ProductTypeOption = {
  id: string
  nombre: string
  baseTipo: string
}

export type ProductCategoryOption = {
  id: string
  nombre: string
}

export type ProductCustomFieldDefinition = {
  id: string
  key: string
  label: string
  fieldType: 'TEXT' | 'LONG_TEXT' | 'NUMBER' | 'BOOLEAN' | 'DATE'
  helpText?: string | null
  required: boolean
  optionsJson?: unknown
}

type BaseTypeOption = {
  value: string
  label: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseTypeOptions: BaseTypeOption[]
  typeOptions: ProductTypeOption[]
  categoryOptions: ProductCategoryOption[]
  customFieldDefinitions: ProductCustomFieldDefinition[]
  onRefresh: () => Promise<void>
}

type FieldType = ProductCustomFieldDefinition['fieldType']

function parseFieldOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

export function ProductConfigDialog(props: Props) {
  const { open, onOpenChange, baseTypeOptions, typeOptions, categoryOptions, customFieldDefinitions, onRefresh } = props

  const [saving, setSaving] = useState(false)
  const [typeForm, setTypeForm] = useState({ id: '', nombre: '', baseTipo: baseTypeOptions[0]?.value ?? 'OTRO' })
  const [categoryForm, setCategoryForm] = useState({ id: '', nombre: '' })
  const [fieldForm, setFieldForm] = useState({
    id: '',
    key: '',
    label: '',
    fieldType: 'TEXT' as FieldType,
    helpText: '',
    optionsText: '',
    required: false,
  })

  useEffect(() => {
    if (typeForm.id) return
    setTypeForm((prev) => ({ ...prev, baseTipo: baseTypeOptions[0]?.value ?? prev.baseTipo ?? 'OTRO' }))
  }, [baseTypeOptions, typeForm.id])

  const fieldTypeOptions = useMemo(
    () => [
      { value: 'TEXT', label: 'Texto corto' },
      { value: 'LONG_TEXT', label: 'Texto largo' },
      { value: 'NUMBER', label: 'Numero' },
      { value: 'BOOLEAN', label: 'Si / No' },
      { value: 'DATE', label: 'Fecha' },
    ],
    []
  )

  const request = async (method: 'POST' | 'PUT' | 'DELETE', body: unknown) => {
    const res = await fetch('/api/materiales/configuracion', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || 'No se pudo guardar la configuracion')
    }
  }

  const resetTypeForm = () => {
    setTypeForm({ id: '', nombre: '', baseTipo: baseTypeOptions[0]?.value ?? 'OTRO' })
  }

  const resetCategoryForm = () => {
    setCategoryForm({ id: '', nombre: '' })
  }

  const resetFieldForm = () => {
    setFieldForm({ id: '', key: '', label: '', fieldType: 'TEXT', helpText: '', optionsText: '', required: false })
  }

  const submitType = async () => {
    if (!typeForm.nombre.trim()) return
    setSaving(true)
    try {
      await request(typeForm.id ? 'PUT' : 'POST', {
        entity: 'typeOption',
        id: typeForm.id || undefined,
        nombre: typeForm.nombre.trim(),
        baseTipo: typeForm.baseTipo,
      })
      resetTypeForm()
      await onRefresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo guardar el tipo')
    } finally {
      setSaving(false)
    }
  }

  const submitCategory = async () => {
    if (!categoryForm.nombre.trim()) return
    setSaving(true)
    try {
      await request(categoryForm.id ? 'PUT' : 'POST', {
        entity: 'categoryOption',
        id: categoryForm.id || undefined,
        nombre: categoryForm.nombre.trim(),
      })
      resetCategoryForm()
      await onRefresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo guardar la categoria')
    } finally {
      setSaving(false)
    }
  }

  const submitField = async () => {
    if (!fieldForm.label.trim()) return
    setSaving(true)
    try {
      await request(fieldForm.id ? 'PUT' : 'POST', {
        entity: 'customField',
        id: fieldForm.id || undefined,
        key: fieldForm.key.trim(),
        label: fieldForm.label.trim(),
        fieldType: fieldForm.fieldType,
        helpText: fieldForm.helpText.trim(),
        required: fieldForm.required,
        options: fieldForm.optionsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      })
      resetFieldForm()
      await onRefresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo guardar el campo')
    } finally {
      setSaving(false)
    }
  }

  const editType = (option: ProductTypeOption) => {
    setTypeForm({ id: option.id, nombre: option.nombre, baseTipo: option.baseTipo })
  }

  const editCategory = (option: ProductCategoryOption) => {
    setCategoryForm({ id: option.id, nombre: option.nombre })
  }

  const editField = (field: ProductCustomFieldDefinition) => {
    setFieldForm({
      id: field.id,
      key: field.key,
      label: field.label,
      fieldType: field.fieldType,
      helpText: field.helpText ?? '',
      optionsText: parseFieldOptions(field.optionsJson).join('\n'),
      required: field.required,
    })
  }

  const removeItem = async (entity: 'typeOption' | 'categoryOption' | 'customField', id: string) => {
    const ok = window.confirm('¿Eliminar este elemento de configuracion?')
    if (!ok) return

    setSaving(true)
    try {
      await request('DELETE', { entity, id })
      if (typeForm.id === id) resetTypeForm()
      if (categoryForm.id === id) resetCategoryForm()
      if (fieldForm.id === id) resetFieldForm()
      await onRefresh()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar productos</DialogTitle>
          <DialogDescription>
            Administra tipos, categorias y campos extra sin cambiar el codigo del modulo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="font-medium">Tipos de producto</h3>
              <p className="text-sm text-muted-foreground">Cada tipo comercial se apoya en un tipo tecnico base.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto_auto]">
              <Input
                value={typeForm.nombre}
                onChange={(e) => setTypeForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Desarrollo web"
              />
              <select
                value={typeForm.baseTipo}
                onChange={(e) => setTypeForm((prev) => ({ ...prev, baseTipo: e.target.value }))}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {baseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Button type="button" onClick={() => void submitType()} disabled={saving}>
                {typeForm.id ? 'Guardar' : 'Agregar'}
              </Button>
              {typeForm.id ? (
                <Button type="button" variant="outline" onClick={resetTypeForm} disabled={saving}>Cancelar</Button>
              ) : null}
            </div>
            <div className="space-y-2">
              {typeOptions.length === 0 ? <p className="text-sm text-muted-foreground">Sin tipos personalizados.</p> : null}
              {typeOptions.map((option) => (
                <div key={option.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm gap-3">
                  <div>
                    <div className="font-medium">{option.nombre}</div>
                    <div className="text-xs text-muted-foreground">Base tecnica: {option.baseTipo}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editType(option)} disabled={saving}>Editar</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void removeItem('typeOption', option.id)} disabled={saving}>Borrar</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="font-medium">Categorias</h3>
              <p className="text-sm text-muted-foreground">Se usan para agrupar y filtrar productos.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Input
                value={categoryForm.nombre}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Servicios digitales"
              />
              <Button type="button" onClick={() => void submitCategory()} disabled={saving}>
                {categoryForm.id ? 'Guardar' : 'Agregar'}
              </Button>
              {categoryForm.id ? (
                <Button type="button" variant="outline" onClick={resetCategoryForm} disabled={saving}>Cancelar</Button>
              ) : null}
            </div>
            <div className="space-y-2">
              {categoryOptions.length === 0 ? <p className="text-sm text-muted-foreground">Sin categorias personalizadas.</p> : null}
              {categoryOptions.map((option) => (
                <div key={option.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm gap-3">
                  <span>{option.nombre}</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editCategory(option)} disabled={saving}>Editar</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void removeItem('categoryOption', option.id)} disabled={saving}>Borrar</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-lg border p-4 lg:col-span-2">
            <div>
              <h3 className="font-medium">Campos extra</h3>
              <p className="text-sm text-muted-foreground">Usalos para atributos especificos como duracion, plataforma, talla o proveedor secundario.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Input value={fieldForm.label} onChange={(e) => setFieldForm((prev) => ({ ...prev, label: e.target.value }))} placeholder="Ej: Duracion del servicio" />
              </div>
              <div className="space-y-2">
                <Label>Clave tecnica</Label>
                <Input
                  value={fieldForm.key}
                  onChange={(e) => setFieldForm((prev) => ({ ...prev, key: e.target.value }))}
                  placeholder="Ej: duracion_servicio"
                  disabled={Boolean(fieldForm.id)}
                />
                {fieldForm.id ? <p className="text-xs text-muted-foreground">La clave se mantiene fija para no romper datos ya guardados.</p> : null}
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select
                  value={fieldForm.fieldType}
                  onChange={(e) => setFieldForm((prev) => ({ ...prev, fieldType: e.target.value as FieldType }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  {fieldTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Ayuda</Label>
                <Input value={fieldForm.helpText} onChange={(e) => setFieldForm((prev) => ({ ...prev, helpText: e.target.value }))} placeholder="Texto de apoyo opcional" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label>Opciones</Label>
                <Textarea value={fieldForm.optionsText} onChange={(e) => setFieldForm((prev) => ({ ...prev, optionsText: e.target.value }))} rows={3} placeholder="Una opcion por linea. Si lo dejas vacio, el campo sera libre." />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fieldForm.required} onChange={(e) => setFieldForm((prev) => ({ ...prev, required: e.target.checked }))} />
                Campo obligatorio
              </label>
            </div>
            <div className="flex justify-end gap-2">
              {fieldForm.id ? <Button type="button" variant="outline" onClick={resetFieldForm} disabled={saving}>Cancelar</Button> : null}
              <Button type="button" onClick={() => void submitField()} disabled={saving}>{fieldForm.id ? 'Guardar campo' : 'Agregar campo'}</Button>
            </div>
            <div className="space-y-2">
              {customFieldDefinitions.length === 0 ? <p className="text-sm text-muted-foreground">Sin campos extra definidos.</p> : null}
              {customFieldDefinitions.map((field) => (
                <div key={field.id} className="flex items-start justify-between rounded-md border px-3 py-2 text-sm gap-3">
                  <div>
                    <div className="font-medium">{field.label}</div>
                    <div className="text-xs text-muted-foreground">Clave: {field.key} · Tipo: {field.fieldType}{field.required ? ' · Obligatorio' : ''}</div>
                    {field.helpText ? <div className="text-xs text-muted-foreground mt-1">{field.helpText}</div> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => editField(field)} disabled={saving}>Editar</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void removeItem('customField', field.id)} disabled={saving}>Borrar</Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
