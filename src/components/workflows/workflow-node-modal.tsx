'use client'

import { Trash2 } from 'lucide-react'
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
import type { WorkflowNode } from '@/lib/workflows'
import { NODE_KIND_DESCRIPTIONS, NODE_KIND_LABELS } from '@/components/workflows/workflow-node-catalog'
import { WorkflowNodeConfigFields } from '@/components/workflows/workflow-node-config-fields'

export function WorkflowNodeModal({
  node,
  open,
  onOpenChange,
  onChangeLabel,
  onChangeConfig,
  onDelete,
}: {
  node: WorkflowNode | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChangeLabel: (id: string, label: string) => void
  onChangeConfig: (id: string, key: string, value: unknown) => void
  onDelete: (id: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        {node ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">
                  {NODE_KIND_LABELS[node.kind] ?? node.kind}
                </span>
                <span className="text-base font-semibold text-slate-900">Configurar nodo</span>
              </DialogTitle>
              <DialogDescription>{NODE_KIND_DESCRIPTIONS[node.kind]}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Nombre del nodo</Label>
                <Input
                  value={node.label}
                  onChange={(event) => onChangeLabel(node.id, event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <WorkflowNodeConfigFields
                node={node}
                onChange={(key, value) => onChangeConfig(node.id, key, value)}
              />
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="text-rose-700 hover:text-rose-700"
                onClick={() => {
                  onDelete(node.id)
                  onOpenChange(false)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar nodo
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
