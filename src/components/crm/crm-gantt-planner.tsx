"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartGantt, Diamond, LayoutTemplate, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GANTT_PLAN_TEMPLATES } from "@/lib/gantt-plan-templates";

const PLAN_COLORS = ["#0F766E", "#2563EB", "#D97706", "#BE123C", "#7C3AED", "#334155"];

type WorkspaceOption = {
  id: string;
  name: string;
  projects: Array<{ id: string; name: string }>;
};

type GanttItem = {
  id: string;
  title: string;
  description?: string | null;
  colorHex?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELED";
  startAt: string;
  dueAt: string;
  progress: number;
  isMilestone: boolean;
  sortOrder: number;
  parentItemId?: string | null;
  linkedTask?: { id: string; title: string } | null;
};

type GanttPlan = {
  id: string;
  name: string;
  description?: string | null;
  colorHex?: string | null;
  workspace?: { id: string; name: string } | null;
  project?: { id: string; workspaceId: string; name: string } | null;
  items: GanttItem[];
};

type ApiResponse<T> = { success?: boolean; data?: T; error?: string };

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function dayDifference(left: Date, right: Date) {
  return Math.round((startOfDay(left).getTime() - startOfDay(right).getTime()) / 86_400_000);
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) return { ...json, success: false };
  return json;
}

export function CrmGanttPlanner({ workspaces }: { workspaces: WorkspaceOption[] }) {
  const [plans, setPlans] = useState<GanttPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [planCreationMode, setPlanCreationMode] = useState<"BLANK" | "TEMPLATE">("BLANK");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateStartDate, setTemplateStartDate] = useState(localDateKey(new Date()));
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    colorHex: PLAN_COLORS[0],
    workspaceId: "",
    projectId: "",
  });
  const [itemForm, setItemForm] = useState({
    title: "",
    description: "",
    colorHex: PLAN_COLORS[1],
    startAt: localDateKey(new Date()),
    dueAt: localDateKey(new Date()),
    progress: 0,
    parentItemId: "",
    isMilestone: false,
  });
  const [aiForm, setAiForm] = useState({
    prompt: "",
    startDate: localDateKey(new Date()),
    workspaceId: "",
    projectId: "",
  });

  async function loadPlans(preferredPlanId?: string) {
    setLoading(true);
    try {
      const json = await requestJson<GanttPlan[]>("/api/crm/gantt-plans");
      if (!json.success || !json.data) {
        alert(json.error || "No se pudieron cargar los planes Gantt.");
        return;
      }
      setPlans(json.data);
      setSelectedPlanId((current) =>
        preferredPlanId || (current && json.data!.some((plan) => plan.id === current)
          ? current
          : json.data![0]?.id || ""),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || null;
  const linkedWorkspace = workspaces.find((workspace) => workspace.id === planForm.workspaceId) || null;
  const aiLinkedWorkspace = workspaces.find((workspace) => workspace.id === aiForm.workspaceId) || null;

  const timeline = useMemo(() => {
    const items = selectedPlan?.items || [];
    const starts = items.map((item) => startOfDay(new Date(item.startAt)));
    const ends = items.map((item) => startOfDay(new Date(item.dueAt)));
    const today = startOfDay(new Date());
    const start = starts.length ? new Date(Math.min(...starts.map((date) => date.getTime()))) : today;
    const end = ends.length ? new Date(Math.max(...ends.map((date) => date.getTime()))) : new Date(today.getTime() + 86_400_000);
    return { start, end, totalDays: Math.max(1, dayDifference(end, start) + 1) };
  }, [selectedPlan]);

  async function createPlan() {
    if (planCreationMode === "BLANK" && !planForm.name.trim()) return alert("Escribe el nombre del plan Gantt.");
    if (planCreationMode === "TEMPLATE" && !selectedTemplateId) return alert("Selecciona una plantilla.");
    setSaving(true);
    try {
      const json = await requestJson<GanttPlan>("/api/crm/gantt-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...planForm,
          ...(planCreationMode === "TEMPLATE"
            ? { templateId: selectedTemplateId, startDate: templateStartDate }
            : {}),
        }),
      });
      if (!json.success || !json.data) return alert(json.error || "No se pudo crear el plan Gantt.");
      setPlanDialogOpen(false);
      setSelectedTemplateId("");
      setPlanForm({ name: "", description: "", colorHex: PLAN_COLORS[0], workspaceId: "", projectId: "" });
      await loadPlans(json.data.id);
    } finally {
      setSaving(false);
    }
  }

  async function createPlanWithAi() {
    if (aiForm.prompt.trim().length < 20) {
      return alert("Describe el proyecto con al menos 20 caracteres.");
    }
    setSaving(true);
    try {
      const json = await requestJson<GanttPlan>("/api/crm/gantt-plans/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aiForm),
      });
      if (!json.success || !json.data) return alert(json.error || "No se pudo generar el plan con IA.");
      setAiDialogOpen(false);
      setAiForm({ prompt: "", startDate: localDateKey(new Date()), workspaceId: "", projectId: "" });
      await loadPlans(json.data.id);
    } finally {
      setSaving(false);
    }
  }

  async function createItem() {
    if (!selectedPlan) return;
    if (!itemForm.title.trim()) return alert("Escribe el nombre de la actividad.");
    setSaving(true);
    try {
      const json = await requestJson<GanttItem>(`/api/crm/gantt-plans/${selectedPlan.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm),
      });
      if (!json.success || !json.data) return alert(json.error || "No se pudo crear la actividad Gantt.");
      setItemDialogOpen(false);
      setItemForm({
        title: "",
        description: "",
        colorHex: selectedPlan.colorHex || PLAN_COLORS[1],
        startAt: localDateKey(new Date()),
        dueAt: localDateKey(new Date()),
        progress: 0,
        parentItemId: "",
        isMilestone: false,
      });
      await loadPlans(selectedPlan.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold uppercase text-slate-500">Plan Gantt</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="h-9 w-[260px] rounded-lg bg-white text-xs">
                <SelectValue placeholder={loading ? "Cargando..." : "Selecciona un plan"} />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedPlan?.workspace ? (
            <div className="pb-2 text-xs text-slate-500">
              Vinculado a {selectedPlan.workspace.name}
              {selectedPlan.project ? ` / ${selectedPlan.project.name}` : ""}
            </div>
          ) : selectedPlan ? (
            <div className="pb-2 text-xs text-slate-500">Plan independiente</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9 rounded-lg" onClick={() => {
            setPlanCreationMode("BLANK");
            setPlanDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />En blanco
          </Button>
          <Button variant="outline" className="h-9 rounded-lg" onClick={() => {
            setPlanCreationMode("TEMPLATE");
            setPlanDialogOpen(true);
          }}>
            <LayoutTemplate className="mr-2 h-4 w-4" />Plantillas
          </Button>
          <Button className="h-9 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />Crear con IA
          </Button>
          <Button className="h-9 rounded-lg bg-slate-950 text-white hover:bg-slate-800" disabled={!selectedPlan} onClick={() => setItemDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Actividad / hito
          </Button>
        </div>
      </div>

      {selectedPlan ? (
        <div className="min-w-[900px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-[300px_1fr] border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <div className="border-r border-slate-200 px-3 py-2.5">{selectedPlan.name}</div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span>{timeline.start.toLocaleDateString("es-CO")}</span>
              <span>{timeline.end.toLocaleDateString("es-CO")}</span>
            </div>
          </div>
          {selectedPlan.items.map((item) => {
            const itemStart = startOfDay(new Date(item.startAt));
            const itemEnd = startOfDay(new Date(item.dueAt));
            const left = (dayDifference(itemStart, timeline.start) / timeline.totalDays) * 100;
            const width = (Math.max(1, dayDifference(itemEnd, itemStart) + 1) / timeline.totalDays) * 100;
            return (
              <div key={item.id} className="grid grid-cols-[300px_1fr] border-b border-slate-100 last:border-b-0">
                <div className={`truncate border-r border-slate-200 py-2.5 text-xs text-slate-700 ${item.parentItemId ? "pl-9 pr-3" : "px-4"}`}>
                  {item.parentItemId ? "↳ " : ""}{item.title}
                  {item.linkedTask ? <span className="ml-2 text-[10px] text-sky-700">Tarea vinculada</span> : null}
                </div>
                <div className="relative min-h-10 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px)] bg-[size:10%_100%]">
                  <span
                    className={`absolute top-2.5 h-5 overflow-hidden shadow-sm ${item.isMilestone ? "w-5 rotate-45 rounded-sm" : "min-w-2 rounded-sm"}`}
                    style={{
                      left: `${Math.max(0, left)}%`,
                      ...(item.isMilestone ? {} : { width: `${Math.max(0.8, Math.min(100 - Math.max(0, left), width))}%` }),
                      backgroundColor: item.colorHex || selectedPlan.colorHex || "#0F766E",
                    }}
                    title={`${item.title}: ${item.progress}%`}
                  >
                    {!item.isMilestone ? <span className="block h-full bg-white/40" style={{ width: `${item.progress}%` }} /> : null}
                  </span>
                </div>
              </div>
            );
          })}
          {!selectedPlan.items.length ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <ChartGantt className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">Este plan todavía no tiene actividades.</p>
              <Button variant="outline" className="mt-3 h-8 rounded-lg text-xs" onClick={() => setItemDialogOpen(true)}>
                Crear primera actividad
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <ChartGantt className="mx-auto h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Crea un plan Gantt independiente o vinculado a un proyecto.</p>
          <p className="mt-1 text-xs text-slate-500">Las tareas normales seguirán separadas hasta que decidas vincularlas.</p>
        </div>
      )}

      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className={planCreationMode === "TEMPLATE" ? "max-h-[90vh] overflow-y-auto sm:max-w-3xl" : "sm:max-w-xl"}>
          <DialogHeader>
            <DialogTitle>{planCreationMode === "TEMPLATE" ? "Crear desde plantilla" : "Nuevo plan Gantt"}</DialogTitle>
            <DialogDescription>
              {planCreationMode === "TEMPLATE"
                ? "Elige una estructura sectorial y empieza a completar datos en lugar de partir de cero."
                : "El plan vive por separado. Vincularlo a un proyecto es opcional."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {planCreationMode === "TEMPLATE" ? (
              <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-3">
                {GANTT_PLAN_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setPlanForm((current) => ({
                        ...current,
                        name: template.name,
                        description: template.description,
                        colorHex: template.colorHex,
                      }));
                    }}
                    className={`border p-3 text-left transition ${
                      selectedTemplateId === template.id
                        ? "border-sky-500 bg-sky-50 ring-2 ring-sky-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{template.name}</span>
                      <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: template.colorHex }} />
                    </div>
                    <p className="mt-1 text-[10px] font-semibold uppercase text-sky-700">{template.sector}</p>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">{template.description}</p>
                    <p className="mt-2 text-[10px] text-slate-400">{template.items.length} actividades e hitos</p>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={planForm.name} disabled={planCreationMode === "TEMPLATE" && !selectedTemplateId} onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            {planCreationMode === "TEMPLATE" ? (
              <div className="space-y-2">
                <Label>Fecha de inicio</Label>
                <Input type="date" value={templateStartDate} onChange={(event) => setTemplateStartDate(event.target.value)} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Proyecto vinculado (opcional)</Label>
              <Select value={planForm.workspaceId || "NONE"} onValueChange={(value) => setPlanForm((current) => ({ ...current, workspaceId: value === "NONE" ? "" : value, projectId: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Plan independiente</SelectItem>
                  {workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lista vinculada (opcional)</Label>
              <Select value={planForm.projectId || "NONE"} disabled={!linkedWorkspace} onValueChange={(value) => setPlanForm((current) => ({ ...current, projectId: value === "NONE" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Todas / ninguna lista</SelectItem>
                  {(linkedWorkspace?.projects || []).map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PLAN_COLORS.map((color) => (
                  <button key={color} type="button" className={`h-8 w-8 rounded-md border-2 ${planForm.colorHex === color ? "border-slate-950" : "border-white"}`} style={{ backgroundColor: color }} onClick={() => setPlanForm((current) => ({ ...current, colorHex: color }))} aria-label={`Color ${color}`} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => void createPlan()} disabled={saving || (planCreationMode === "TEMPLATE" && !selectedTemplateId)}>{saving ? "Creando..." : planCreationMode === "TEMPLATE" ? "Usar plantilla" : "Crear plan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sky-600" />
              Crear proyecto con IA
            </DialogTitle>
            <DialogDescription>
              Describe el resultado, alcance y fecha objetivo. La IA propondrá fases, subtareas, hitos y dependencias editables.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>¿Qué proyecto quieres planificar?</Label>
              <Textarea
                value={aiForm.prompt}
                maxLength={2000}
                rows={6}
                onChange={(event) => setAiForm((current) => ({ ...current, prompt: event.target.value }))}
                placeholder="Ejemplo: Implementar una tienda virtual para una empresa de ropa en 8 semanas. Incluye diseño, catálogo, pagos, logística, pruebas, capacitación y lanzamiento."
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>No incluyas contraseñas ni información sensible.</span>
                <span>{aiForm.prompt.length}/2000</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={aiForm.startDate} onChange={(event) => setAiForm((current) => ({ ...current, startDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Proyecto vinculado (opcional)</Label>
              <Select value={aiForm.workspaceId || "NONE"} onValueChange={(value) => setAiForm((current) => ({ ...current, workspaceId: value === "NONE" ? "" : value, projectId: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Plan independiente</SelectItem>
                  {workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-start-2">
              <Label>Lista vinculada (opcional)</Label>
              <Select value={aiForm.projectId || "NONE"} disabled={!aiLinkedWorkspace} onValueChange={(value) => setAiForm((current) => ({ ...current, projectId: value === "NONE" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Todas / ninguna lista</SelectItem>
                  {(aiLinkedWorkspace?.projects || []).map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-sky-600 text-white hover:bg-sky-700" onClick={() => void createPlanWithAi()} disabled={saving || aiForm.prompt.trim().length < 20}>
              <Sparkles className="mr-2 h-4 w-4" />
              {saving ? "Generando plan..." : "Generar y crear plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva actividad Gantt</DialogTitle>
            <DialogDescription>Esta actividad solo vive dentro del plan Gantt seleccionado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre</Label>
              <Input value={itemForm.title} onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Actividad padre (opcional)</Label>
              <Select value={itemForm.parentItemId || "NONE"} onValueChange={(value) => setItemForm((current) => ({ ...current, parentItemId: value === "NONE" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nivel principal</SelectItem>
                  {(selectedPlan?.items || []).map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input id="gantt-milestone" type="checkbox" checked={itemForm.isMilestone} onChange={(event) => setItemForm((current) => ({ ...current, isMilestone: event.target.checked }))} />
              <Label htmlFor="gantt-milestone" className="flex items-center gap-2"><Diamond className="h-4 w-4" />Es un hito</Label>
            </div>
            <div className="space-y-2">
              <Label>Inicio</Label>
              <Input type="date" value={itemForm.startAt} onChange={(event) => setItemForm((current) => ({ ...current, startAt: event.target.value, ...(current.isMilestone ? { dueAt: event.target.value } : {}) }))} />
            </div>
            <div className="space-y-2">
              <Label>Fin</Label>
              <Input type="date" value={itemForm.isMilestone ? itemForm.startAt : itemForm.dueAt} min={itemForm.startAt} disabled={itemForm.isMilestone} onChange={(event) => setItemForm((current) => ({ ...current, dueAt: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Avance: {itemForm.progress}%</Label>
              <input type="range" min="0" max="100" step="5" value={itemForm.progress} onChange={(event) => setItemForm((current) => ({ ...current, progress: Number(event.target.value) }))} className="w-full accent-slate-950" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input type="color" value={itemForm.colorHex} onChange={(event) => setItemForm((current) => ({ ...current, colorHex: event.target.value }))} className="h-9 p-1" />
            </div>
          </div>
          <DialogFooter><Button onClick={() => void createItem()} disabled={saving}>{saving ? "Creando..." : itemForm.isMilestone ? "Crear hito" : "Crear actividad"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
