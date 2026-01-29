'use client'

import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ImportModule = 'clientes' | 'proveedores' | 'materiales' | 'compras' | 'ordenes'

type ImportResult = {
  module: string
  totalRows: number
  created?: number
  toCreate?: number
  warnings?: string[]
  errors?: Array<{ row: number; error: string }>
}

const TEMPLATE_HEADERS: Record<ImportModule, string[]> = {
  clientes: ['nombre', 'tipoDocumento', 'documento', 'email', 'telefono', 'celular', 'direccion', 'ciudad', 'departamento'],
  proveedores: ['nombre', 'nit', 'telefono', 'direccion', 'email', 'contacto', 'ciudad', 'departamento', 'observaciones', 'activo'],
  materiales: [
    'nombre',
    'tipo',
    'categoria',
    'ancho',
    'largo',
    'espesor',
    'color',
    'precioM2',
    'precioMetro',
    'precioUnidad',
    'precioCompra',
    'stockActual',
    'stockMinimo',
    'unidadMedida',
    'tipoProducto',
    'proveedor',
    'observaciones',
    'activo',
  ],
  compras: ['fechaCompra', 'proveedorNombre', 'numeroFactura', 'subtotalSinIva', 'iva', 'total', 'sede', 'observaciones'],
  ordenes: ['fecha', 'clienteNombre', 'clienteDocumento', 'subtotal', 'iva', 'total', 'observaciones'],
}

function downloadCsvTemplate(module: ImportModule) {
  const headers = TEMPLATE_HEADERS[module]
  const csv = `${headers.join(',')}\n`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plantilla-${module}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ImportDialog({ module, title }: { module: ImportModule; title?: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dryRun, setDryRun] = useState(false)

  const inputRef = useRef<HTMLInputElement | null>(null)

  const headers = useMemo(() => TEMPLATE_HEADERS[module], [module])

  async function runImport() {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      if (dryRun) form.append('dryRun', 'true')

      const res = await fetch(`/api/import/${module}`, { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) {
        alert(json?.error || 'No se pudo importar')
        setResult(json?.data ?? null)
        return
      }
      setResult(json.data as ImportResult)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Importar (CSV/Excel)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title ?? `Importar ${module}`}</DialogTitle>
            <DialogDescription>
              Sube un archivo <span className="font-mono">.csv</span> o <span className="font-mono">.xlsx</span>. Puedes descargar una plantilla.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Columnas sugeridas: <span className="font-mono">{headers.join(', ')}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => downloadCsvTemplate(module)}>
                Descargar plantilla CSV
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Archivo</Label>
              <Input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                }}
              />
              <div className="flex items-center gap-2">
                <input
                  id={`dryrun-${module}`}
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                <Label htmlFor={`dryrun-${module}`}>Dry-run (no guarda, solo valida)</Label>
              </div>
            </div>

            {result ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-sm">
                  <span className="font-medium">Filas detectadas:</span> {result.totalRows}
                  {typeof result.created === 'number' ? (
                    <> · <span className="font-medium">Creadas:</span> {result.created}</>
                  ) : null}
                  {typeof result.toCreate === 'number' ? (
                    <> · <span className="font-medium">Válidas:</span> {result.toCreate}</>
                  ) : null}
                </div>

                {result.warnings?.length ? (
                  <div className="text-xs text-amber-700">
                    <div className="font-medium">Advertencias</div>
                    <ul className="list-disc pl-5">
                      {result.warnings.slice(0, 5).map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {result.errors?.length ? (
                  <div className="text-xs text-red-700">
                    <div className="font-medium">Errores (primeros 10)</div>
                    <ul className="list-disc pl-5">
                      {result.errors.slice(0, 10).map((e, idx) => (
                        <li key={idx}>
                          Fila {e.row}: {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => {
              setFile(null)
              setResult(null)
              setDryRun(false)
              if (inputRef.current) inputRef.current.value = ''
            }} disabled={loading}>
              Limpiar
            </Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cerrar
              </Button>
              <Button type="button" onClick={() => void runImport()} disabled={!file || loading}>
                {loading ? 'Importando…' : dryRun ? 'Validar' : 'Importar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
