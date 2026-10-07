"use client";

import { forwardRef, useMemo, useRef, useState } from "react";
import { Bell, Copy, GripVertical, MessageSquare, MoreHorizontal, Pencil, StickyNote, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IdentityAvatar } from "@/components/ui/identity-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GanttItem, GanttPlan } from "@/components/crm/crm-gantt-planner";

export type GanttScale = "HOUR_1" | "HOUR_3" | "HOUR_6" | "HOUR_12" | "DAY" | "WEEK" | "MONTH";

const SCALES: Array<{ value: GanttScale; label: string; shortLabel: string; cellWidth: number }> = [
  { value: "HOUR_1", label: "1 hora", shortLabel: "1 h", cellWidth: 72 },
  { value: "HOUR_3", label: "3 horas", shortLabel: "3 h", cellWidth: 76 },
  { value: "HOUR_6", label: "6 horas", shortLabel: "6 h", cellWidth: 82 },
  { value: "HOUR_12", label: "12 horas", shortLabel: "12 h", cellWidth: 88 },
  { value: "DAY", label: "Días", shortLabel: "Día", cellWidth: 92 },
  { value: "WEEK", label: "Semanas", shortLabel: "Sem.", cellWidth: 116 },
  { value: "MONTH", label: "Meses", shortLabel: "Mes", cellWidth: 140 },
];

function floorDate(value: Date, scale: GanttScale) {
  const result = new Date(value);
  result.setMinutes(0, 0, 0);
  if (scale.startsWith("HOUR_")) {
    const hours = Number(scale.replace("HOUR_", ""));
    result.setHours(Math.floor(result.getHours() / hours) * hours);
  } else if (scale === "DAY") result.setHours(0, 0, 0, 0);
  else if (scale === "WEEK") {
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  } else {
    result.setHours(0, 0, 0, 0);
    result.setDate(1);
  }
  return result;
}

function addInterval(value: Date, scale: GanttScale, amount = 1) {
  const result = new Date(value);
  if (scale.startsWith("HOUR_")) result.setHours(result.getHours() + Number(scale.replace("HOUR_", "")) * amount);
  else if (scale === "DAY") result.setDate(result.getDate() + amount);
  else if (scale === "WEEK") result.setDate(result.getDate() + 7 * amount);
  else result.setMonth(result.getMonth() + amount);
  return result;
}

function formatTick(value: Date, scale: GanttScale) {
  if (scale.startsWith("HOUR_")) return `${value.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })} · ${value.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
  if (scale === "DAY") return value.toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" });
  if (scale === "WEEK") return `Sem. ${value.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}`;
  return value.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

function ItemMenu({ item, onEdit, onCollaboration, onDuplicate, onDelete }: { item: GanttItem; onEdit: (item: GanttItem) => void; onCollaboration: (item: GanttItem) => void; onDuplicate: (item: GanttItem) => void; onDelete: (item: GanttItem) => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 bg-white/95 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label={`Opciones de ${item.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem onClick={() => onEdit(item)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onCollaboration(item)}><MessageSquare className="mr-2 h-4 w-4" />Conversación y evidencias</DropdownMenuItem>
      <DropdownMenuItem onClick={() => onDuplicate(item)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => onDelete(item)}><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

type Props = {
  plan: GanttPlan;
  scale: GanttScale;
  onScaleChange: (scale: GanttScale) => void;
  onEditPlan: () => void;
  onDuplicatePlan: () => void;
  onDeletePlan: () => void;
  onEditItem: (item: GanttItem) => void;
  onOpenCollaboration: (item: GanttItem) => void;
  onDuplicateItem: (item: GanttItem) => void;
  onDeleteItem: (item: GanttItem) => void;
  avatarMode: "HOVER" | "PINNED";
  onAvatarModeChange: (mode: "HOVER" | "PINNED") => void;
  onMoveItemDates: (item: GanttItem, startAt: Date, dueAt: Date) => void;
  onReorderItem: (item: GanttItem, targetIndex: number) => void;
};

export const CrmGanttTimeline = forwardRef<HTMLDivElement, Props>(function CrmGanttTimeline({ plan, scale, onScaleChange, onEditPlan, onDuplicatePlan, onDeletePlan, onEditItem, onOpenCollaboration, onDuplicateItem, onDeleteItem, avatarMode, onAvatarModeChange, onMoveItemDates, onReorderItem }, ref) {
  const [dragPreview, setDragPreview] = useState<{ itemId: string; intervals: number } | null>(null);
  const dragStartX = useRef(0);
  const axis = useMemo(() => {
    const dates = plan.items.flatMap((item) => [new Date(item.startAt), new Date(item.dueAt)]).filter((date) => !Number.isNaN(date.getTime()));
    const now = new Date();
    const earliest = dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : now;
    const latest = dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : addInterval(now, "DAY", 7);
    const start = addInterval(floorDate(earliest, scale), scale, -1);
    let end = addInterval(floorDate(latest, scale), scale, 2);
    const ticks: Date[] = [];
    let cursor = new Date(start);
    while (cursor < end && ticks.length < 5000) {
      ticks.push(cursor);
      cursor = addInterval(cursor, scale);
    }
    end = cursor;
    const cellWidth = SCALES.find((option) => option.value === scale)?.cellWidth || 92;
    return { start, end, ticks, cellWidth, width: Math.max(900, ticks.length * cellWidth), duration: Math.max(1, end.getTime() - start.getTime()) };
  }, [plan.items, scale]);
  const position = (value: Date) => ((value.getTime() - axis.start.getTime()) / axis.duration) * 100;
  const nowPosition = position(new Date());
  const scaleIndex = SCALES.findIndex((option) => option.value === scale);

  function finishDateDrag(item: GanttItem) {
    const intervals = dragPreview?.itemId === item.id ? dragPreview.intervals : 0;
    setDragPreview(null);
    if (!intervals) return;
    onMoveItemDates(item, addInterval(new Date(item.startAt), scale, intervals), addInterval(new Date(item.dueAt), scale, intervals));
  }

  return <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-1 text-xs text-slate-500"><span className="mr-1">Escala</span><Button variant="outline" size="icon" className="h-8 w-8" disabled={scaleIndex >= SCALES.length - 1} onClick={() => onScaleChange(SCALES[scaleIndex + 1].value)} title="Alejar"><ZoomOut className="h-4 w-4" /></Button><Select value={scale} onValueChange={(value) => onScaleChange(value as GanttScale)}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent>{SCALES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="icon" className="h-8 w-8" disabled={scaleIndex <= 0} onClick={() => onScaleChange(SCALES[scaleIndex - 1].value)} title="Acercar"><ZoomIn className="h-4 w-4" /></Button></div>
      <div className="flex items-center gap-2"><span className="text-[11px] text-slate-500">Avatares</span><Select value={avatarMode} onValueChange={(value) => onAvatarModeChange(value as "HOVER" | "PINNED")}><SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="HOVER">Al pasar</SelectItem><SelectItem value="PINNED">Siempre visibles</SelectItem></SelectContent></Select></div>
    </div>
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div ref={ref} className="relative" style={{ width: `${300 + axis.width}px` }}>
        <div className="group grid border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600" style={{ gridTemplateColumns: `300px ${axis.width}px` }}>
          <div className="sticky left-0 z-30 flex min-w-0 items-center justify-between gap-2 border-r border-slate-200 bg-slate-50 px-3 py-2.5"><span className="truncate">{plan.name}</span><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" aria-label="Opciones del plan"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={onEditPlan}><Pencil className="mr-2 h-4 w-4" />Editar plan</DropdownMenuItem><DropdownMenuItem onClick={onDuplicatePlan}><Copy className="mr-2 h-4 w-4" />Duplicar plan</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={onDeletePlan}><Trash2 className="mr-2 h-4 w-4" />Eliminar plan</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
          <div className="relative h-14 overflow-hidden">{axis.ticks.map((tick, index) => { const next = axis.ticks[index + 1] || axis.end; const left = position(tick); const width = position(next) - left; return <div key={tick.toISOString()} className="absolute inset-y-0 border-r border-slate-200 px-2 py-2 text-[10px] font-medium text-slate-600" style={{ left: `${left}%`, width: `${width}%` }}><span className="whitespace-nowrap">{formatTick(tick, scale)}</span></div> })}</div>
        </div>
        {plan.items.map((item) => {
          const itemStart = new Date(item.startAt);
          const itemEnd = new Date(item.dueAt);
          const left = Math.max(0, position(itemStart));
          const end = Math.min(100, position(item.isMilestone ? addInterval(itemEnd, scale, 0.18) : itemEnd));
          const width = Math.max(item.isMilestone ? 0.5 : 0.35, end - left);
          const previewIntervals = dragPreview?.itemId === item.id ? dragPreview.intervals : 0;
          const previewOffset = previewIntervals * axis.cellWidth;
          return <div key={item.id} onDragOver={(event) => { if (plan.canEdit) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const sourceId = event.dataTransfer.getData("text/gantt-item"); const source = plan.items.find((candidate) => candidate.id === sourceId); if (source && source.id !== item.id) onReorderItem(source, plan.items.findIndex((candidate) => candidate.id === item.id)); }} className="group grid border-b border-slate-100 last:border-b-0" style={{ gridTemplateColumns: `300px ${axis.width}px` }}>
            <div className={`sticky left-0 z-20 flex min-w-0 items-center gap-1 border-r border-slate-200 bg-white py-2 text-xs text-slate-700 ${item.parentItemId ? "pl-6 pr-2" : "px-2"}`}>{plan.canEdit ? <span draggable onDragStart={(event) => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/gantt-item", item.id); }} className="cursor-grab text-slate-300 active:cursor-grabbing" title="Arrastrar para reordenar"><GripVertical className="h-4 w-4" /></span> : null}<span className="min-w-0 flex-1 truncate">{item.parentItemId ? "↳ " : ""}{item.title}</span>{item.description ? <span title={item.description}><StickyNote className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-label="Tiene notas" /></span> : null}{item.hasUnreadComments ? <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-rose-600" onClick={() => onOpenCollaboration(item)} title="Hay notas sin leer"><Bell className="h-4 w-4 fill-current" /></Button> : null}<ItemMenu item={item} onEdit={onEditItem} onCollaboration={onOpenCollaboration} onDuplicate={onDuplicateItem} onDelete={onDeleteItem} /></div>
            <div className="relative h-12 bg-slate-50/30">{axis.ticks.map((tick) => <span key={tick.toISOString()} className="absolute inset-y-0 border-l border-slate-100" style={{ left: `${position(tick)}%` }} />)}{nowPosition >= 0 && nowPosition <= 100 ? <span className="absolute inset-y-0 z-10 w-px bg-rose-400" style={{ left: `${nowPosition}%` }} title="Ahora" /> : null}<div onPointerDown={(event) => { if (!plan.canEdit || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); dragStartX.current = event.clientX; setDragPreview({ itemId: item.id, intervals: 0 }); }} onPointerMove={(event) => { if (dragPreview?.itemId !== item.id) return; setDragPreview({ itemId: item.id, intervals: Math.round((event.clientX - dragStartX.current) / axis.cellWidth) }); }} onPointerUp={() => finishDateDrag(item)} onPointerCancel={() => setDragPreview(null)} className={`absolute top-3.5 h-6 touch-none select-none ${plan.canEdit ? "cursor-grab active:cursor-grabbing" : ""} ${item.isMilestone ? "w-6 rotate-45" : "min-w-2 overflow-hidden rounded-sm"}`} style={{ left: `${left}%`, width: item.isMilestone ? undefined : `${width}%`, backgroundColor: item.colorHex || plan.colorHex || "#0F766E", transform: `translateX(${previewOffset}px)` }} title={`${item.title} · ${new Date(item.startAt).toLocaleString("es-CO")} → ${new Date(item.dueAt).toLocaleString("es-CO")}`}><span className="block h-full bg-white/35" style={{ width: `${item.progress}%` }} /></div>{item.assignments?.length ? <div className={`absolute top-0 z-20 flex -space-x-1 transition-opacity ${avatarMode === "PINNED" ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} style={{ left: `${left}%`, transform: `translateX(${previewOffset}px)` }}>{item.assignments.slice(0, 4).map((assignment) => <IdentityAvatar key={assignment.id} size="sm" className="h-5 w-5 border-white text-[8px]" label={assignment.user.name || assignment.user.email} imageUrl={assignment.user.image} />)}</div> : null}<div className="absolute top-2 z-20 -translate-x-full" style={{ left: `${Math.min(99.5, left + width)}%` }}><ItemMenu item={item} onEdit={onEditItem} onCollaboration={onOpenCollaboration} onDuplicate={onDuplicateItem} onDelete={onDeleteItem} /></div></div>
          </div>;
        })}
      </div>
    </div>
  </div>;
});