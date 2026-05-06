'use client'

import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/providers/i18n-provider'

type NavPrefs = Record<string, boolean>
type NavOrder = string[]
type SectionOrder = string[]

export type NavSettingsItem = {
  name: string
  href: string
  section?: string
}

function normalizeOrder(items: NavSettingsItem[], order: NavOrder | undefined): NavOrder {
  const known = new Set(items.map((item) => item.href))
  const base = Array.isArray(order) ? order.filter((href) => known.has(href)) : []
  const missing = items.map((item) => item.href).filter((href) => !base.includes(href))
  return [...base, ...missing]
}

function reorderItems(order: NavOrder, fromHref: string, toHref: string): NavOrder {
  if (!fromHref || !toHref || fromHref === toHref) return order
  const next = [...order]
  const fromIndex = next.indexOf(fromHref)
  const toIndex = next.indexOf(toHref)
  if (fromIndex === -1 || toIndex === -1) return order
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function reorderValues(values: string[], fromValue: string, toValue: string): string[] {
  if (!fromValue || !toValue || fromValue === toValue) return values
  const next = [...values]
  const fromIndex = next.indexOf(fromValue)
  const toIndex = next.indexOf(toValue)
  if (fromIndex === -1 || toIndex === -1) return values
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function normalizeSectionOrder(items: NavSettingsItem[], order: NavOrder | undefined): SectionOrder {
  const sections = new Set<string>()

  for (const href of normalizeOrder(items, order)) {
    const item = items.find((entry) => entry.href === href)
    sections.add(item?.section?.trim() || 'Otros')
  }

  for (const item of items) {
    sections.add(item.section?.trim() || 'Otros')
  }

  return Array.from(sections)
}

function groupOrderBySections(items: NavSettingsItem[], order: NavOrder, sectionOrder: SectionOrder): NavOrder {
  const buckets = new Map<string, string[]>()
  const normalized = normalizeOrder(items, order)

  for (const href of normalized) {
    const item = items.find((entry) => entry.href === href)
    const section = item?.section?.trim() || 'Otros'
    const current = buckets.get(section)
    if (current) {
      current.push(href)
    } else {
      buckets.set(section, [href])
    }
  }

  const next: string[] = []
  for (const section of sectionOrder) {
    const hrefs = buckets.get(section)
    if (hrefs?.length) next.push(...hrefs)
  }

  return next
}

export function NavSettingsDialog({
  items,
  value,
  order,
  onSave,
  open: controlledOpen,
  onOpenChange,
  trigger,
}: {
  items: NavSettingsItem[]
  value: NavPrefs
  order?: NavOrder
  onSave: (next: NavPrefs, nextOrder: NavOrder) => Promise<void> | void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: (open: () => void) => React.ReactNode
}) {
  const { t } = useI18n()
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<NavPrefs>(value)
  const [draftOrder, setDraftOrder] = useState<NavOrder>(() => normalizeOrder(items, order))
  const [draftSectionOrder, setDraftSectionOrder] = useState<SectionOrder>(() => normalizeSectionOrder(items, order))
  const [draggingHref, setDraggingHref] = useState<string | null>(null)
  const [draggingSection, setDraggingSection] = useState<string | null>(null)
  const open = controlledOpen ?? uncontrolledOpen

  const itemSectionMap = useMemo(() => {
    return new Map(items.map((item) => [item.href, item.section?.trim() || 'Otros']))
  }, [items])

  const orderedItems = useMemo(() => {
    const orderMap = new Map(normalizeOrder(items, draftOrder).map((href, index) => [href, index]))
    return [...items].sort((a, b) => (orderMap.get(a.href) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.href) ?? Number.MAX_SAFE_INTEGER))
  }, [draftOrder, items])

  const groupedItems = useMemo(() => {
    return draftSectionOrder
      .map((section) => ({
        section,
        items: orderedItems.filter((item) => (item.section?.trim() || 'Otros') === section),
      }))
      .filter((group) => group.items.length > 0)
  }, [draftSectionOrder, orderedItems])

  function syncDrafts() {
    setDraft(value)
    setDraftOrder(normalizeOrder(items, order))
    setDraftSectionOrder(normalizeSectionOrder(items, order))
  }

  function setDialogOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  function openDialog() {
    syncDrafts()
    setDialogOpen(true)
  }

  useEffect(() => {
    if (controlledOpen) {
      syncDrafts()
    }
  }, [controlledOpen, value, order, items])

  function resetAll(enabled: boolean) {
    const next: NavPrefs = {}
    for (const it of items) next[it.href] = enabled
    setDraft(next)
  }

  function resetOrder() {
    setDraftOrder(items.map((item) => item.href))
    setDraftSectionOrder(normalizeSectionOrder(items, undefined))
  }

  function setSectionVisibility(section: string, enabled: boolean) {
    setDraft((current) => {
      const next = { ...current }
      for (const item of items) {
        if ((item.section?.trim() || 'Otros') === section) {
          next[item.href] = enabled
        }
      }
      return next
    })
  }

  function handleDrop(targetHref: string) {
    if (!draggingHref) return
    if (itemSectionMap.get(draggingHref) !== itemSectionMap.get(targetHref)) {
      setDraggingHref(null)
      return
    }
    setDraftOrder((current) => reorderItems(normalizeOrder(items, current), draggingHref, targetHref))
    setDraggingHref(null)
  }

  function handleSectionDrop(targetSection: string) {
    if (!draggingSection) return
    const nextSectionOrder = reorderValues(draftSectionOrder, draggingSection, targetSection)
    setDraftSectionOrder(nextSectionOrder)
    setDraftOrder((current) => groupOrderBySections(items, current, nextSectionOrder))
    setDraggingSection(null)
  }

  function handleDragStart(event: DragEvent<HTMLLabelElement>, href: string) {
    setDraggingHref(href)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', href)
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(draft, groupOrderBySections(items, draftOrder, draftSectionOrder))
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {trigger ? (
        trigger(openDialog)
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openDialog}
        >
          {t('navSettings.title')}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setDialogOpen}>
        <DialogContent className="h-[88vh] grid-rows-[auto,minmax(0,1fr),auto] w-[96vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <DialogTitle>{t('navSettings.title')}</DialogTitle>
                <DialogDescription>{t('navSettings.description')}</DialogDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => resetAll(true)} disabled={saving}>
                  {t('navSettings.showAll')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => resetAll(false)} disabled={saving}>
                  {t('navSettings.hideAll')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetOrder} disabled={saving}>
                  Restablecer orden
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <div className="space-y-5 pb-1">
              {groupedItems.map((group) => (
                <section
                  key={group.section}
                  draggable={!saving}
                  onDragStart={(event) => {
                    setDraggingSection(group.section)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', group.section)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleSectionDrop(group.section)}
                  onDragEnd={() => setDraggingSection(null)}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="cursor-grab select-none pt-0.5 text-slate-400" aria-hidden="true">⋮⋮</span>
                      <h3 className="text-sm font-semibold text-slate-900">{group.section}</h3>
                      <p className="text-xs text-slate-500">Activa, oculta y reordena los accesos de esta seccion.</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSectionVisibility(group.section, true)} disabled={saving}>
                        Mostrar seccion
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setSectionVisibility(group.section, false)} disabled={saving}>
                        Ocultar seccion
                      </Button>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 shadow-sm">
                        {group.items.filter((item) => draft[item.href] !== false).length}/{group.items.length} visibles
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((it) => {
                      const checked = draft[it.href] ?? true
                      return (
                        <label
                          key={it.href}
                          draggable={!saving}
                          onDragStart={(event) => handleDragStart(event, it.href)}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={() => handleDrop(it.href)}
                          onDragEnd={() => setDraggingHref(null)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                        >
                          <span className="cursor-grab select-none text-slate-500" aria-hidden="true">⋮⋮</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setDraft((prev) => ({ ...prev, [it.href]: e.target.checked }))}
                            disabled={saving}
                          />
                          <Label className="cursor-pointer text-sm leading-snug">{it.name}</Label>
                        </label>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? t('navSettings.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
