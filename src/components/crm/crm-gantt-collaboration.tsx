"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, MessageSquare, Send, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IdentityAvatar } from "@/components/ui/identity-avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GanttItem, GanttPlan } from "@/components/crm/crm-gantt-planner";

type UserSummary = { id: string; name: string | null; email: string | null; image: string | null };
type Member = { id: string; userId: string; role: string; user: UserSummary };
type Comment = { id: string; message: string; createdAt: string; isCurrentUser: boolean; author: UserSummary };
type Assignment = { id: string; userId: string; user: UserSummary };
type Attachment = { id: string; name: string; url: string; mimeType?: string | null; sizeBytes?: number | null };
type ApiResponse<T> = { success?: boolean; data?: T; error?: string };

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => ({})) as ApiResponse<T>;
  return { ...json, success: response.ok && json.success !== false };
}

function userLabel(user: UserSummary) {
  return user.name?.trim() || user.email?.trim() || "Usuario";
}

export function GanttMembersDialog({ plan, open, onOpenChange }: { plan: GanttPlan | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !plan) return;
    void requestJson<{ members: Member[]; users: UserSummary[]; canManage: boolean; currentUserId: string }>(`/api/crm/gantt-plans/${plan.id}/members`)
      .then((json) => {
        if (!json.success || !json.data) return alert(json.error || "No se pudieron cargar los colaboradores.");
        setMembers(json.data.members);
        setUsers(json.data.users);
        setCanManage(json.data.canManage);
        setCurrentUserId(json.data.currentUserId);
      });
  }, [open, plan]);

  const available = users.filter((user) => user.id !== currentUserId && !members.some((member) => member.userId === user.id));

  async function invite() {
    if (!plan || !selectedUserId) return;
    setBusy(true);
    const json = await requestJson<Member>(`/api/crm/gantt-plans/${plan.id}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: selectedUserId }) });
    setBusy(false);
    if (!json.success || !json.data) return alert(json.error || "No se pudo invitar al colaborador.");
    setMembers((current) => [...current.filter((member) => member.userId !== json.data!.userId), json.data!]);
    setSelectedUserId("");
  }

  async function remove(member: Member) {
    if (!plan || !window.confirm(`¿Retirar a ${userLabel(member.user)} de este plan?`)) return;
    const json = await requestJson<never>(`/api/crm/gantt-plans/${plan.id}/members?userId=${encodeURIComponent(member.userId)}`, { method: "DELETE" });
    if (!json.success) return alert(json.error || "No se pudo retirar al colaborador.");
    setMembers((current) => current.filter((candidate) => candidate.id !== member.id));
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Colaboradores del plan</DialogTitle><DialogDescription>Los invitados pueden ver el cronograma, comentar actividades y adjuntar evidencias.</DialogDescription></DialogHeader>
      {canManage ? <div className="flex gap-2"><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger className="min-w-0 flex-1"><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger><SelectContent>{available.map((user) => <SelectItem key={user.id} value={user.id}>{userLabel(user)}{user.email && user.name ? ` · ${user.email}` : ""}</SelectItem>)}</SelectContent></Select><Button size="icon" onClick={() => void invite()} disabled={!selectedUserId || busy} title="Invitar"><UserPlus className="h-4 w-4" /></Button></div> : null}
      <div className="max-h-80 space-y-2 overflow-y-auto py-1">
        {busy && !members.length ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : null}
        {!busy && !members.length ? <p className="py-8 text-center text-sm text-slate-500">Todavía no hay colaboradores invitados.</p> : null}
        {members.map((member) => <div key={member.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"><IdentityAvatar size="sm" className="h-8 w-8" label={userLabel(member.user)} imageUrl={member.user.image} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{userLabel(member.user)}</p><p className="truncate text-xs text-slate-500">Puede ver y comentar</p></div>{canManage ? <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => void remove(member)} title="Retirar"><Trash2 className="h-4 w-4" /></Button> : null}</div>)}
      </div>
    </DialogContent>
  </Dialog>;
}

type CollaborationData = { comments: Comment[]; assignments: Assignment[]; attachments: Attachment[] | null; availableUsers: UserSummary[]; canComment: boolean; canEdit: boolean };

export function GanttItemCollaborationDialog({ plan, item, open, onOpenChange, onUpdated }: { plan: GanttPlan | null; item: GanttItem | null; open: boolean; onOpenChange: (open: boolean) => void; onUpdated: () => void }) {
  const [data, setData] = useState<CollaborationData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadedEndpoint, setLoadedEndpoint] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const endpoint = plan && item ? `/api/crm/gantt-plans/${plan.id}/items/${item.id}` : "";

  useEffect(() => {
    if (!open || !endpoint) return;
    void requestJson<CollaborationData>(`${endpoint}/collaboration`).then((json) => {
      if (!json.success || !json.data) return alert(json.error || "No se pudo abrir la conversación.");
      setData({ ...json.data, attachments: Array.isArray(json.data.attachments) ? json.data.attachments : [] });
      setLoadedEndpoint(endpoint);
      onUpdated();
    });
  }, [endpoint, onUpdated, open]);

  useEffect(() => { conversationEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.comments.length]);

  async function sendComment() {
    if (!message.trim() || !data) return;
    setBusy(true);
    const json = await requestJson<Comment>(`${endpoint}/collaboration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    setBusy(false);
    if (!json.success || !json.data) return alert(json.error || "No se pudo publicar la nota.");
    setData((current) => current ? { ...current, comments: [...current.comments, json.data!] } : current);
    setMessage("");
  }

  async function toggleAssignment(userId: string) {
    if (!data?.canEdit) return;
    const currentIds = data.assignments.map((assignment) => assignment.userId);
    const userIds = currentIds.includes(userId) ? currentIds.filter((id) => id !== userId) : [...currentIds, userId];
    const json = await requestJson<Assignment[]>(`${endpoint}/collaboration`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userIds }) });
    if (!json.success || !json.data) return alert(json.error || "No se pudieron actualizar los responsables.");
    setData((current) => current ? { ...current, assignments: json.data! } : current);
    onUpdated();
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    const json = await requestJson<Attachment>(`${endpoint}/attachments`, { method: "POST", body: form });
    setBusy(false);
    if (!json.success || !json.data) return alert(json.error || "No se pudo adjuntar la evidencia.");
    setData((current) => current ? { ...current, attachments: [...(current.attachments || []), json.data!] } : current);
    onUpdated();
  }

  async function removeAttachment(attachment: Attachment) {
    if (!window.confirm(`¿Eliminar la evidencia “${attachment.name}”?`)) return;
    const json = await requestJson<never>(`${endpoint}/attachments?attachmentId=${encodeURIComponent(attachment.id)}`, { method: "DELETE" });
    if (!json.success) return alert(json.error || "No se pudo eliminar la evidencia.");
    setData((current) => current ? { ...current, attachments: (current.attachments || []).filter((candidate) => candidate.id !== attachment.id) } : current);
    onUpdated();
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92vh] overflow-hidden p-0 sm:max-w-3xl">
      <DialogHeader className="border-b border-slate-200 px-5 py-4"><DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />{item?.title || "Actividad"}</DialogTitle><DialogDescription>Conversación, responsables y evidencias de la actividad.</DialogDescription></DialogHeader>
      {!data || loadedEndpoint !== endpoint ? <div className="flex h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : <div className="grid min-h-0 md:grid-cols-[1fr_240px]">
        <div className="flex min-h-0 flex-col border-r border-slate-200">
          <div className="max-h-[48vh] min-h-64 flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-4">
            {!data.comments.length ? <p className="py-10 text-center text-sm text-slate-500">Inicia la conversación de esta actividad.</p> : null}
            {data.comments.map((comment) => <div key={comment.id} className={`flex gap-2 ${comment.isCurrentUser ? "flex-row-reverse" : ""}`}><IdentityAvatar size="sm" className="h-7 w-7" label={userLabel(comment.author)} imageUrl={comment.author.image} /><div className={`max-w-[82%] border px-3 py-2 ${comment.isCurrentUser ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-center gap-x-2"><span className="text-[11px] font-semibold text-slate-700">{userLabel(comment.author)}</span><time className="text-[10px] text-slate-400">{new Date(comment.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.message}</p></div></div>)}
            <div ref={conversationEndRef} />
          </div>
          {data.canComment ? <div className="flex items-end gap-2 border-t border-slate-200 p-3"><Textarea rows={2} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe una nota, decisión o avance..." onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendComment(); } }} /><Button size="icon" className="shrink-0" disabled={busy || !message.trim()} onClick={() => void sendComment()} title="Publicar nota"><Send className="h-4 w-4" /></Button></div> : null}
        </div>
        <aside className="max-h-[65vh] space-y-5 overflow-y-auto p-4">
          <section><Label className="text-xs uppercase text-slate-500">Responsables</Label><div className="mt-2 space-y-2">{data.availableUsers.map((user) => { const checked = data.assignments.some((assignment) => assignment.userId === user.id); return <label key={user.id} className={`flex items-center gap-2 text-sm ${data.canEdit ? "cursor-pointer" : ""}`}><input type="checkbox" checked={checked} disabled={!data.canEdit} onChange={() => void toggleAssignment(user.id)} /><IdentityAvatar size="sm" className="h-6 w-6 text-[9px]" label={userLabel(user)} imageUrl={user.image} /><span className="min-w-0 truncate">{userLabel(user)}</span></label>; })}</div></section>
          <section><div className="flex items-center justify-between gap-2"><Label className="text-xs uppercase text-slate-500">Evidencias</Label>{data.canComment ? <><Input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} /><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => fileRef.current?.click()} disabled={busy} title="Adjuntar imagen"><ImagePlus className="h-4 w-4" /></Button></> : null}</div><div className="mt-2 grid grid-cols-2 gap-2">{(data.attachments || []).map((attachment) => <div key={attachment.id} className="group relative aspect-square overflow-hidden border border-slate-200 bg-slate-100"><a href={attachment.url} target="_blank" rel="noreferrer" title={attachment.name}><Image src={attachment.url} alt={attachment.name} fill unoptimized sizes="110px" className="object-cover" /></a>{data.canEdit ? <Button variant="destructive" size="icon" className="absolute right-1 top-1 h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => void removeAttachment(attachment)} title="Eliminar evidencia"><Trash2 className="h-3.5 w-3.5" /></Button> : null}</div>)}</div>{!data.attachments?.length ? <p className="mt-3 text-xs text-slate-400">Sin imágenes adjuntas.</p> : null}</section>
        </aside>
      </div>}
      <DialogFooter className="border-t border-slate-200 px-5 py-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}