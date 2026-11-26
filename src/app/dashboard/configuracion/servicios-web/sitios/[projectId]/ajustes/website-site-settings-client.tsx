'use client'

import { useState } from 'react'
import { Code2, Loader2, Palette, PanelBottom, PanelTop, Plus, Save, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WebsiteSiteSettings } from '@/lib/website-site-settings'

type SiteLink = { label: string; href: string }

function LinksEditor({ links, onChange }: { links: SiteLink[]; onChange: (links: SiteLink[]) => void }) {
  function updateLink(index: number, patch: Partial<SiteLink>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)))
  }
  function removeLink(index: number) {
    onChange(links.filter((_, i) => i !== index))
  }
  function addLink() {
    onChange([...links, { label: '', href: '#' }])
  }
  return (
    <div className="space-y-2">
      {links.map((link, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input value={link.label} onChange={(e) => updateLink(index, { label: e.target.value })} placeholder="Texto del enlace" className="min-w-[140px] flex-1" />
          <Input value={link.href} onChange={(e) => updateLink(index, { href: e.target.value })} placeholder="/seccion" className="min-w-[140px] flex-1" />
          <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(index)} aria-label="Quitar enlace"><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLink}><Plus className="h-4 w-4" /> Agregar enlace</Button>
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#ffffff" className="flex-1 font-mono text-sm" />
      <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer p-1" />
    </div>
  )
}

export default function WebsiteSiteSettingsClient({
  projectId,
  projectName,
  initialSettings,
  isSuperAdmin,
}: {
  projectId: string
  projectName: string
  initialSettings: WebsiteSiteSettings
  isSuperAdmin: boolean
}) {
  const { toast } = useToast()
  const [settings, setSettings] = useState<WebsiteSiteSettings>(initialSettings)
  const [saving, setSaving] = useState(false)

  const patchTheme = (patch: Partial<WebsiteSiteSettings['theme']>) => setSettings((s) => ({ ...s, theme: { ...s.theme, ...patch } }))
  const patchHeader = (patch: Partial<WebsiteSiteSettings['header']>) => setSettings((s) => ({ ...s, header: { ...s.header, ...patch } }))
  const patchFooter = (patch: Partial<WebsiteSiteSettings['footer']>) => setSettings((s) => ({ ...s, footer: { ...s.footer, ...patch } }))

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch(`/api/servicios-web/projects/${projectId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron guardar los ajustes.')
      toast({ title: 'Ajustes guardados', description: 'Los cambios se reflejan en el preview y en el sitio publicado.' })
    } catch (error) {
      toast({ title: 'Error guardando', description: error instanceof Error ? error.message : 'Intenta nuevamente.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Ajustes del sitio · {projectName}</CardTitle>
            <CardDescription>Estos ajustes aplican a todas las páginas del sitio.</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar cambios
          </Button>
        </CardHeader>
      </Card>

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Tema global</CardTitle>
          <CardDescription>Paleta, tipografía, botones y ancho del contenedor.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label>Color de fondo</Label><ColorField value={settings.theme.backgroundColor} onChange={(v) => patchTheme({ backgroundColor: v })} /></div>
          <div className="space-y-2"><Label>Color de texto</Label><ColorField value={settings.theme.textColor} onChange={(v) => patchTheme({ textColor: v })} /></div>
          <div className="space-y-2"><Label>Color de acento</Label><ColorField value={settings.theme.accentColor} onChange={(v) => patchTheme({ accentColor: v })} /></div>
          <div className="space-y-2"><Label>Tipografía</Label><Input value={settings.theme.fontFamily} onChange={(e) => patchTheme({ fontFamily: e.target.value })} placeholder="ui-sans-serif, system-ui, sans-serif" /></div>
          <div className="space-y-2"><Label>Tipografía de títulos</Label><Input value={settings.theme.headingFontFamily} onChange={(e) => patchTheme({ headingFontFamily: e.target.value })} placeholder="Opcional" /></div>
          <div className="space-y-2"><Label>Radio de botones (px)</Label><Input type="number" min={0} max={40} value={settings.theme.buttonRadius} onChange={(e) => patchTheme({ buttonRadius: Number(e.target.value) || 0 })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Ancho del contenedor (px)</Label><Input type="number" min={640} max={1600} value={settings.theme.containerMaxWidth} onChange={(e) => patchTheme({ containerMaxWidth: Number(e.target.value) || 1240 })} /></div>
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PanelTop className="h-4 w-4" /> Header global</CardTitle>
          <CardDescription>Menú superior compartido en todas las páginas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <Label htmlFor="header-enabled">Activar header global</Label>
            <Switch id="header-enabled" checked={settings.header.enabled} onCheckedChange={(v) => patchHeader({ enabled: v })} />
          </div>
          {settings.header.enabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Marca</Label><Input value={settings.header.brand} onChange={(e) => patchHeader({ brand: e.target.value })} placeholder="Mi marca" /></div>
              <div className="space-y-2"><Label>Logo (URL)</Label><Input value={settings.header.logoUrl} onChange={(e) => patchHeader({ logoUrl: e.target.value })} placeholder="https://..." /></div>
              <div className="space-y-2"><Label>Texto del botón</Label><Input value={settings.header.buttonLabel} onChange={(e) => patchHeader({ buttonLabel: e.target.value })} placeholder="Hablemos" /></div>
              <div className="space-y-2"><Label>Enlace del botón</Label><Input value={settings.header.buttonHref} onChange={(e) => patchHeader({ buttonHref: e.target.value })} placeholder="#contacto" /></div>
              <div className="space-y-2"><Label>Color de fondo</Label><ColorField value={settings.header.backgroundColor} onChange={(v) => patchHeader({ backgroundColor: v })} /></div>
              <div className="space-y-2"><Label>Color de texto</Label><ColorField value={settings.header.textColor} onChange={(v) => patchHeader({ textColor: v })} /></div>
              <div className="flex items-center gap-2 sm:col-span-2"><Switch id="header-sticky" checked={settings.header.sticky} onCheckedChange={(v) => patchHeader({ sticky: v })} /><Label htmlFor="header-sticky">Fijo al hacer scroll</Label></div>
              <div className="space-y-2 sm:col-span-2"><Label>Enlaces del menú</Label><LinksEditor links={settings.header.links} onChange={(links) => patchHeader({ links })} /></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><PanelBottom className="h-4 w-4" /> Footer global</CardTitle>
          <CardDescription>Pie de página compartido en todas las páginas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <Label htmlFor="footer-enabled">Activar footer global</Label>
            <Switch id="footer-enabled" checked={settings.footer.enabled} onCheckedChange={(v) => patchFooter({ enabled: v })} />
          </div>
          {settings.footer.enabled ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Marca</Label><Input value={settings.footer.brand} onChange={(e) => patchFooter({ brand: e.target.value })} placeholder="Mi marca" /></div>
              <div className="space-y-2"><Label>Copyright</Label><Input value={settings.footer.copyright} onChange={(e) => patchFooter({ copyright: e.target.value })} placeholder="© 2026 Mi marca" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Descripción</Label><Textarea value={settings.footer.description} onChange={(e) => patchFooter({ description: e.target.value })} rows={2} /></div>
              <div className="space-y-2"><Label>Color de fondo</Label><ColorField value={settings.footer.backgroundColor} onChange={(v) => patchFooter({ backgroundColor: v })} /></div>
              <div className="space-y-2"><Label>Color de texto</Label><ColorField value={settings.footer.textColor} onChange={(v) => patchFooter({ textColor: v })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Enlaces</Label><LinksEditor links={settings.footer.links} onChange={(links) => patchFooter({ links })} /></div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="h-4 w-4" /> CSS personalizado</CardTitle>
          <CardDescription>Se inyecta en todas las páginas publicadas. Puedes usar --jc-accent, --jc-bg, --jc-text, --jc-font, --jc-radius y --jc-container.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea value={settings.customCss} onChange={(e) => setSettings((s) => ({ ...s, customCss: e.target.value }))} rows={8} className="font-mono text-sm" placeholder={'/* Ejemplo */\n.jc-site .jc-site-btn{text-transform:uppercase}'} />
        </CardContent>
      </Card>

      <Card className="rounded-[26px] border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Code2 className="h-4 w-4" /> Scripts personalizados</CardTitle>
          <CardDescription>Solo superadmin. Se ejecutan únicamente en el sitio publicado (no en el preview).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSuperAdmin ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ShieldAlert className="h-4 w-4 shrink-0" /> Solo el superadmin puede editar scripts personalizados.
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Script en &lt;head&gt;</Label>
            <Textarea value={settings.customJsHead} disabled={!isSuperAdmin} onChange={(e) => setSettings((s) => ({ ...s, customJsHead: e.target.value }))} rows={5} className="font-mono text-sm" placeholder="JS inline (fuentes, analytics)" />
          </div>
          <div className="space-y-2">
            <Label>Script antes de &lt;/body&gt;</Label>
            <Textarea value={settings.customJsBody} disabled={!isSuperAdmin} onChange={(e) => setSettings((s) => ({ ...s, customJsBody: e.target.value }))} rows={5} className="font-mono text-sm" placeholder="JS inline (tracking, widgets, chat)" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

