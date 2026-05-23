'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableNativeSelect, type SearchableNativeSelectOption } from '@/components/ui/searchable-native-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { OdontogramChart } from '@/components/odontologia/odontogram-chart'
import { type DentitionType, type OdontologyClinicalAttachment, type OdontogramEntry, findToothEntry, getPatientAgeYears, inferDentitionTypeFromBirthDate, normalizeClinicalLabel, normalizeToothCode } from '@/lib/odontology'
import { cn } from '@/lib/utils'

type ClienteOption = {
  id: string
  nombre: string
  documento: string
}

type DropdownOption = {
  id: string
  value: string
  label: string
  sortOrder: number
  meta?: {
    suggestedCostCOP?: number
    scope?: string
  } | null
}

type Dropdown = {
  id: string
  key: string
  nombre: string
  items: DropdownOption[]
}

type RecentRecord = {
  id: string
  appointmentDate: string
  consultationReason: string
  treatmentStatus: string | null
  nextVisitAt: string | null
  diagnosis?: string | null
  odontogram?: { entries?: OdontogramEntry[]; attachments?: OdontologyClinicalAttachment[] } | null
  cliente: { id: string; nombre: string; documento: string }
}

type Appointment = {
  id: string
  startsAt: string
  endsAt: string
  status: string
  reason: string
  chairName: string | null
  cliente: { id: string; nombre: string; documento: string }
  assignedDentist: { id: string; name: string | null; email: string | null } | null
}

type TreatmentPlanItem = {
  id: string
  toothCode: string | null
  procedureType: string
  status: string
  estimatedCost: number
}

type TreatmentPlan = {
  id: string
  title: string
  status: string
  estimatedTotal: number
  diagnosisSummary: string | null
  updatedAt: string
  cliente: { id: string; nombre: string; documento: string }
  items: TreatmentPlanItem[]
  _count: { items: number; appointments: number; clinicalRecords: number }
}

type OverviewResponse = {
  totals: {
    patientProfiles: number
    clinicalRecords: number
    scheduledAppointments: number
    activeTreatmentPlans: number
  }
  recentRecords: RecentRecord[]
  upcomingAppointments: Appointment[]
  treatmentPlans: TreatmentPlan[]
  dropdowns: Dropdown[]
}

type ClinicalHistoryRecord = {
  id: string
  appointmentDate: string
  consultationReason: string
  treatmentStatus: string | null
  diagnosis: string | null
  procedureSummary: string | null
  observations: string | null
  nextVisitAt: string | null
  odontogram?: { entries?: OdontogramEntry[]; attachments?: OdontologyClinicalAttachment[]; sessionLabel?: string | null; dentitionType?: DentitionType } | null
  patientProfile?: {
    birthDate: string | null
    bloodType: string | null
    allergies: string | null
    currentMedications: string | null
  } | null
  cliente: { id: string; nombre: string; documento: string }
}

type ToothHistoryItem = {
  recordId: string
  appointmentDate: string
  consultationReason: string
  treatmentStatus: string | null
  procedureSummary: string | null
  diagnosis: string | null
  entry: OdontogramEntry
}

type ToothDraft = {
  condition: string
  diagnosis: string
  recommendedProcedure: string
  notes: string
}

const initialRecordForm = {
  clienteId: '',
  consultationReason: '',
  treatmentStatus: '',
  diagnosis: '',
  procedureSummary: '',
  observations: '',
  appointmentDate: '',
  nextVisitAt: '',
  birthDate: '',
  dentitionType: 'ADULT' as DentitionType,
  bloodType: '',
  allergies: '',
  currentMedications: '',
  odontogramEntries: [] as OdontogramEntry[],
  sessionAttachments: [] as OdontologyClinicalAttachment[],
}

const initialToothDraft: ToothDraft = {
  condition: '',
  diagnosis: '',
  recommendedProcedure: '',
  notes: '',
}

const initialAppointmentForm = {
  clienteId: '',
  reason: '',
  startsAt: '',
  durationMinutes: '45',
  chairName: '',
  notes: '',
}

const initialPlanForm = {
  clienteId: '',
  title: '',
  diagnosisSummary: '',
  objectives: '',
  notes: '',
}

const initialPlanItemDraft = {
  toothCode: '',
  procedureType: '',
  description: '',
  estimatedCost: '',
  scheduledAt: '',
}

type PlanItemDraft = typeof initialPlanItemDraft

const FALLBACK_DROPDOWNS: Record<string, DropdownOption[]> = {
  odontologia_motivo_consulta: [
    { id: 'fallback-control', value: 'CONTROL', label: 'Control general', sortOrder: 10 },
    { id: 'fallback-dolor', value: 'DOLOR', label: 'Dolor dental', sortOrder: 20 },
    { id: 'fallback-valoracion', value: 'VALORACION', label: 'Valoración inicial', sortOrder: 30 },
    { id: 'fallback-urgencia', value: 'URGENCIA', label: 'Urgencia', sortOrder: 40 },
    { id: 'fallback-estetica', value: 'ESTETICA', label: 'Estética dental', sortOrder: 50 },
  ],
  odontologia_estado_tratamiento: [
    { id: 'fallback-valoracion-trat', value: 'VALORACION', label: 'En valoración', sortOrder: 10 },
    { id: 'fallback-encurso', value: 'EN_CURSO', label: 'En tratamiento', sortOrder: 20 },
    { id: 'fallback-pausado', value: 'PAUSADO', label: 'Pausado', sortOrder: 30 },
    { id: 'fallback-finalizado', value: 'FINALIZADO', label: 'Finalizado', sortOrder: 40 },
    { id: 'fallback-remision', value: 'REMISION', label: 'Remisión externa', sortOrder: 50 },
  ],
  odontologia_tipo_procedimiento: [
    { id: 'fallback-limpieza', value: 'LIMPIEZA', label: 'Limpieza', sortOrder: 10 },
    { id: 'fallback-resina', value: 'RESINA', label: 'Resina', sortOrder: 20 },
    { id: 'fallback-endodoncia', value: 'ENDODONCIA', label: 'Endodoncia', sortOrder: 30 },
    { id: 'fallback-exodoncia', value: 'EXODONCIA', label: 'Exodoncia', sortOrder: 40 },
    { id: 'fallback-ortodoncia', value: 'ORTODONCIA', label: 'Ortodoncia', sortOrder: 50 },
  ],
  odontologia_estado_cita: [
    { id: 'fallback-scheduled', value: 'SCHEDULED', label: 'Agendada', sortOrder: 10 },
    { id: 'fallback-confirmed', value: 'CONFIRMED', label: 'Confirmada', sortOrder: 20 },
    { id: 'fallback-progress', value: 'IN_PROGRESS', label: 'En atención', sortOrder: 30 },
    { id: 'fallback-completed', value: 'COMPLETED', label: 'Atendida', sortOrder: 40 },
    { id: 'fallback-cancelled', value: 'CANCELLED', label: 'Cancelada', sortOrder: 50 },
    { id: 'fallback-noshow', value: 'NO_SHOW', label: 'No asistió', sortOrder: 60 },
  ],
  odontologia_condicion_dental: [
    { id: 'fallback-sano', value: 'SANO', label: 'Sano', sortOrder: 10 },
    { id: 'fallback-caries', value: 'CARIES', label: 'Caries', sortOrder: 20 },
    { id: 'fallback-fractura', value: 'FRACTURA', label: 'Fractura', sortOrder: 30 },
    { id: 'fallback-endo-previa', value: 'ENDODONCIA_PREVIA', label: 'Endodoncia previa', sortOrder: 40 },
    { id: 'fallback-ausente', value: 'AUSENTE', label: 'Ausente', sortOrder: 50 },
    { id: 'fallback-movilidad', value: 'MOVILIDAD', label: 'Movilidad', sortOrder: 60 },
    { id: 'fallback-restauracion', value: 'RESTAURACION', label: 'Restauración', sortOrder: 70 },
  ],
}

const nativeSearchClassName = 'h-9 rounded-xl border-slate-200 bg-white text-sm'
const nativeSelectClassName = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400'

function formatDate(date: string | null) {
  if (!date) return 'Sin fecha'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
  } catch {
    return date
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value || 0)
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatPatientStage(birthDate: string) {
  const age = getPatientAgeYears(birthDate)
  if (age === null) return 'Sin edad registrada'
  return `${age} ${age === 1 ? 'año' : 'años'}`
}

function getDropdownOptions(overview: OverviewResponse | null, key: string) {
  const options = overview?.dropdowns.find((item) => item.key === key)?.items ?? []
  return options.length ? options : (FALLBACK_DROPDOWNS[key] ?? [])
}

function toNativeOptions(options: DropdownOption[]): SearchableNativeSelectOption[] {
  return options.map((item) => ({ value: item.value, label: item.label }))
}

function normalizeStatusLabel(value: string | null | undefined) {
  if (!value) return 'Sin estado'
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function diffEntries(current: OdontogramEntry[], previous: OdontogramEntry[]) {
  const previousMap = new Map(previous.map((entry) => [entry.toothCode, entry]))
  const changes: string[] = []

  for (const entry of current) {
    const older = previousMap.get(entry.toothCode)
    if (!older) {
      changes.push(`Nueva pieza ${entry.toothCode}: ${normalizeClinicalLabel(entry.condition)}`)
      continue
    }
    if (older.condition !== entry.condition) {
      changes.push(`Pieza ${entry.toothCode}: ${normalizeClinicalLabel(older.condition)} -> ${normalizeClinicalLabel(entry.condition)}`)
    }
  }

  for (const older of previous) {
    if (!current.some((entry) => entry.toothCode === older.toothCode)) {
      changes.push(`Pieza ${older.toothCode}: salió del registro actual`)
    }
  }

  return changes
}

function renderAttachmentPreview(attachment: OdontologyClinicalAttachment) {
  if (attachment.type === 'image') {
    return (
      <div className="relative h-28 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Image src={attachment.url} alt={attachment.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 200px" unoptimized />
      </div>
    )
  }

  return <div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-600">Documento clínico</div>
}

function buildOdontogramEntry(toothCode: string, draft: ToothDraft): OdontogramEntry | null {
  if (!toothCode || !draft.condition) return null

  return {
    toothCode,
    condition: draft.condition,
    diagnosis: draft.diagnosis.trim() || `Condicion registrada: ${normalizeClinicalLabel(draft.condition)}`,
    recommendedProcedure: draft.recommendedProcedure || null,
    notes: draft.notes.trim() || null,
  }
}

function mergeOdontogramEntries(entries: OdontogramEntry[], draftsByCode: Record<string, ToothDraft>) {
  const merged = new Map(entries.map((entry) => [entry.toothCode, entry]))

  for (const [toothCode, draft] of Object.entries(draftsByCode)) {
    const nextEntry = buildOdontogramEntry(toothCode, draft)
    if (nextEntry) merged.set(toothCode, nextEntry)
  }

  return Array.from(merged.values()).sort((left, right) => left.toothCode.localeCompare(right.toothCode))
}

function buildToothHistory(records: ClinicalHistoryRecord[], toothCode: string | null): ToothHistoryItem[] {
  if (!toothCode) return []

  return records.flatMap((record) => {
    const entry = findToothEntry(record.odontogram?.entries ?? [], toothCode)
    if (!entry) return []

    return [{
      recordId: record.id,
      appointmentDate: record.appointmentDate,
      consultationReason: record.consultationReason,
      treatmentStatus: record.treatmentStatus,
      procedureSummary: record.procedureSummary,
      diagnosis: record.diagnosis,
      entry,
    }]
  })
}

export default function OdontologiaDashboardPage() {
  const [clientes, setClientes] = useState<ClienteOption[]>([])
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingRecord, setSavingRecord] = useState(false)
  const [savingAppointment, setSavingAppointment] = useState(false)
  const [savingPlan, setSavingPlan] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [recordForm, setRecordForm] = useState(initialRecordForm)
  const [appointmentForm, setAppointmentForm] = useState(initialAppointmentForm)
  const [planForm, setPlanForm] = useState(initialPlanForm)
  const [planItems, setPlanItems] = useState<Array<{ toothCode: string | null; procedureType: string; description: string; estimatedCost: string; scheduledAt: string }>>([])
  const [planItemDraft, setPlanItemDraft] = useState(initialPlanItemDraft)
  const [selectedToothCode, setSelectedToothCode] = useState<string | null>(null)
  const [toothDraft, setToothDraft] = useState(initialToothDraft)
  const [toothDraftsByCode, setToothDraftsByCode] = useState<Record<string, ToothDraft>>({})
  const [historyRecords, setHistoryRecords] = useState<ClinicalHistoryRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [dentitionTouched, setDentitionTouched] = useState(false)

  async function loadWorkspace() {
    const [overviewRes, clientesRes] = await Promise.all([
      fetch('/api/odontologia/overview', { cache: 'no-store' }),
      fetch('/api/clientes', { cache: 'no-store' }),
    ])

    const overviewJson = (await overviewRes.json().catch(() => null)) as { ok?: boolean; data?: OverviewResponse; error?: string } | null
    const clientesJson = (await clientesRes.json().catch(() => null)) as { data?: Array<{ id: string; nombre: string; documento: string }> } | null

    if (!overviewRes.ok || !overviewJson?.ok || !overviewJson.data) {
      throw new Error(overviewJson?.error || 'No se pudo cargar el panel odontológico')
    }

    setOverview(overviewJson.data)
    setClientes(Array.isArray(clientesJson?.data) ? clientesJson.data : [])
  }

  async function loadPatientHistory(clienteId: string) {
    if (!clienteId) {
      setHistoryRecords([])
      return
    }

    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/odontologia/records?clienteId=${encodeURIComponent(clienteId)}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: ClinicalHistoryRecord[]; error?: string } | null
      if (!res.ok || !json?.ok || !Array.isArray(json.data)) {
        throw new Error(json?.error || 'No se pudo cargar el historial clínico')
      }
      setHistoryRecords(json.data)
      const latestProfile = json.data[0]?.patientProfile
      if (latestProfile) {
        setRecordForm((current) => {
          const nextBirthDate = current.birthDate || toDateInputValue(latestProfile.birthDate)
          return {
            ...current,
            birthDate: nextBirthDate,
            dentitionType: !dentitionTouched ? inferDentitionTypeFromBirthDate(nextBirthDate) : current.dentitionType,
            bloodType: current.bloodType || latestProfile.bloodType || '',
            allergies: current.allergies || latestProfile.allergies || '',
            currentMedications: current.currentMedications || latestProfile.currentMedications || '',
          }
        })
      }
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'No se pudo cargar el historial clínico')
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        if (cancelled) return
        await loadWorkspace()
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la vista odontológica')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void loadPatientHistory(recordForm.clienteId)
  }, [recordForm.clienteId])

  useEffect(() => {
    if (dentitionTouched) return
    const inferred = inferDentitionTypeFromBirthDate(recordForm.birthDate)
    setRecordForm((current) => current.dentitionType === inferred ? current : { ...current, dentitionType: inferred })
  }, [recordForm.birthDate, dentitionTouched])

  const consultationOptions = useMemo(() => getDropdownOptions(overview, 'odontologia_motivo_consulta'), [overview?.dropdowns])
  const treatmentStatusOptions = useMemo(() => getDropdownOptions(overview, 'odontologia_estado_tratamiento'), [overview?.dropdowns])
  const procedureOptions = useMemo(() => getDropdownOptions(overview, 'odontologia_tipo_procedimiento'), [overview?.dropdowns])
  const appointmentStatusOptions = useMemo(() => getDropdownOptions(overview, 'odontologia_estado_cita'), [overview?.dropdowns])
  const toothConditionOptions = useMemo(() => getDropdownOptions(overview, 'odontologia_condicion_dental'), [overview?.dropdowns])
  const clienteOptions = useMemo<SearchableNativeSelectOption[]>(() => clientes.map((cliente) => ({ value: cliente.id, label: `${cliente.nombre} · ${cliente.documento}` })), [clientes])
  const consultationNativeOptions = useMemo(() => toNativeOptions(consultationOptions), [consultationOptions])
  const treatmentNativeOptions = useMemo(() => toNativeOptions(treatmentStatusOptions), [treatmentStatusOptions])
  const procedureNativeOptions = useMemo(() => toNativeOptions(procedureOptions), [procedureOptions])
  const toothConditionNativeOptions = useMemo(() => toNativeOptions(toothConditionOptions), [toothConditionOptions])
  const appointmentNativeOptions = useMemo(() => toNativeOptions(appointmentStatusOptions), [appointmentStatusOptions])
  const selectedHistory = useMemo(() => historyRecords, [historyRecords])
  const mergedOdontogramEntries = useMemo(() => mergeOdontogramEntries(recordForm.odontogramEntries, toothDraftsByCode), [recordForm.odontogramEntries, toothDraftsByCode])
  const selectedToothHistory = useMemo(() => buildToothHistory(historyRecords, selectedToothCode), [historyRecords, selectedToothCode])
  const patientAgeLabel = useMemo(() => formatPatientStage(recordForm.birthDate), [recordForm.birthDate])
  const clienteById = useMemo(() => new Map(clientes.map((cliente) => [cliente.id, cliente])), [clientes])
  const suggestedPlanItems = useMemo(
    () => mergedOdontogramEntries
      .map((entry) => buildPlanItemFromOdontogramEntry(entry, procedureOptions))
      .filter((item): item is PlanItemDraft => Boolean(item)),
    [mergedOdontogramEntries, procedureOptions],
  )
  const suggestedPlanTotal = useMemo(
    () => suggestedPlanItems.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0),
    [suggestedPlanItems],
  )

  function updateToothDraft(patch: Partial<ToothDraft>) {
    setToothDraft((current) => {
      const nextDraft = { ...current, ...patch }

      if (selectedToothCode) {
        setToothDraftsByCode((currentDrafts) => ({
          ...currentDrafts,
          [selectedToothCode]: nextDraft,
        }))
      }

      return nextDraft
    })
  }

  function handleSelectTooth(toothCode: string) {
    setSelectedToothCode(toothCode)
    const currentDraft = toothDraftsByCode[toothCode]
    const currentEntry = findToothEntry(mergedOdontogramEntries, toothCode)
    setToothDraft(
      currentDraft
        ? currentDraft
        : currentEntry
        ? {
            condition: currentEntry.condition,
            diagnosis: currentEntry.diagnosis,
            recommendedProcedure: currentEntry.recommendedProcedure || '',
            notes: currentEntry.notes || '',
          }
        : initialToothDraft,
    )
  }

  function upsertSelectedTooth() {
    if (!selectedToothCode) {
      setError('Selecciona una pieza dental en el odontograma.')
      return
    }
    const entry = buildOdontogramEntry(selectedToothCode, toothDraft)
    if (!entry) {
      setError('Selecciona una condición para la pieza dental.')
      return
    }

    setRecordForm((current) => ({
      ...current,
      odontogramEntries: [...current.odontogramEntries.filter((item) => item.toothCode !== selectedToothCode), entry],
    }))
    setToothDraftsByCode((current) => ({
      ...current,
      [selectedToothCode]: toothDraft,
    }))
    setStatus(`Pieza ${selectedToothCode} actualizada en el odontograma.`)
  }

  function removeToothEntry(toothCode: string) {
    setRecordForm((current) => ({
      ...current,
      odontogramEntries: current.odontogramEntries.filter((item) => item.toothCode !== toothCode),
    }))
    setToothDraftsByCode((current) => {
      const next = { ...current }
      delete next[toothCode]
      return next
    })
    if (selectedToothCode === toothCode) {
      setSelectedToothCode(null)
      setToothDraft(initialToothDraft)
    }
  }

  function addPlanItem() {
    const toothCode = normalizeToothCode(planItemDraft.toothCode)
    if (!planItemDraft.procedureType) {
      setError('Selecciona un procedimiento para agregarlo al plan.')
      return
    }

    setPlanItems((current) => [
      ...current,
      {
        toothCode,
        procedureType: planItemDraft.procedureType,
        description: planItemDraft.description,
        estimatedCost: planItemDraft.estimatedCost,
        scheduledAt: planItemDraft.scheduledAt,
      },
    ])
    setPlanItemDraft(initialPlanItemDraft)
  }

  function appendPlanItems(itemsToAdd: PlanItemDraft[]) {
    if (!itemsToAdd.length) {
      setError('No hay procedimientos sugeridos para enviar al plan todavía.')
      return
    }

    const cliente = recordForm.clienteId ? clienteById.get(recordForm.clienteId) : null

    setPlanForm((current) => ({
      ...current,
      clienteId: current.clienteId || recordForm.clienteId,
      title: current.title || (cliente ? `Plan integral · ${cliente.nombre}` : 'Plan odontológico inicial'),
      diagnosisSummary: current.diagnosisSummary || recordForm.diagnosis,
      notes: current.notes || recordForm.observations,
    }))

    setPlanItems((current) => {
      const existing = new Map(current.map((item) => [buildPlanItemKey(item), item]))
      for (const item of itemsToAdd) {
        existing.set(buildPlanItemKey(item), item)
      }
      return Array.from(existing.values())
    })

    setStatus(`${itemsToAdd.length} procedimiento(s) enviados al plan de tratamiento.`)
  }

  function importSuggestedProceduresToPlan() {
    appendPlanItems(suggestedPlanItems)
  }

  function pushSelectedToothToPlan() {
    if (!selectedToothCode) {
      setError('Selecciona una pieza para enviarla al plan.')
      return
    }

    const entry = findToothEntry(mergedOdontogramEntries, selectedToothCode)
    const nextItem = entry ? buildPlanItemFromOdontogramEntry(entry, procedureOptions) : null
    if (!nextItem) {
      setError('La pieza seleccionada no tiene procedimiento sugerido para presupuestar.')
      return
    }

    appendPlanItems([nextItem])
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingRecord(true)
    setError(null)
    setStatus(null)

    try {
      const res = await fetch('/api/odontologia/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...recordForm,
          odontogram: { version: 1, entries: mergedOdontogramEntries, attachments: recordForm.sessionAttachments, dentitionType: recordForm.dentitionType },
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo registrar la evolución clínica')

      setStatus('Evolución clínica registrada.')
      setRecordForm(initialRecordForm)
      setSelectedToothCode(null)
      setToothDraft(initialToothDraft)
      setToothDraftsByCode({})
      setDentitionTouched(false)

      await loadWorkspace()
      await loadPatientHistory(recordForm.clienteId)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo registrar la evolución clínica')
    } finally {
      setSavingRecord(false)
    }
  }

  async function updateAppointmentStatus(appointmentId: string, nextStatus: string) {
    setError(null)
    setStatus(null)

    try {
      const res = await fetch('/api/odontologia/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, status: nextStatus }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo actualizar el estado de la cita')

      setStatus('Estado de cita actualizado.')
      await loadWorkspace()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el estado de la cita')
    }
  }

  async function uploadClinicalAttachment(file: File | null) {
    if (!file) return

    setUploadingAttachment(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/odontologia/attachments', {
        method: 'POST',
        body: formData,
      })

      const json = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: OdontologyClinicalAttachment; error?: string }
      if (!response.ok || !json.ok || !json.data) {
        throw new Error(json.error || 'No se pudo subir el archivo clínico')
      }

      const attachment = json.data

      setRecordForm((current) => current.sessionAttachments.some((item) => item.url === attachment.url)
        ? current
        : { ...current, sessionAttachments: [...current.sessionAttachments, attachment] })
      setStatus('Archivo clínico agregado a la evolución.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'No se pudo subir el archivo clínico')
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingAppointment(true)
    setError(null)
    setStatus(null)

    try {
      const res = await fetch('/api/odontologia/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentForm),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo crear la cita odontológica')

      setStatus('Cita odontológica creada.')
      setAppointmentForm(initialAppointmentForm)

      await loadWorkspace()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear la cita odontológica')
    } finally {
      setSavingAppointment(false)
    }
  }

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSavingPlan(true)
    setError(null)
    setStatus(null)

    try {
      const res = await fetch('/api/odontologia/treatment-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...planForm,
          items: planItems.map((item) => ({
            ...item,
            estimatedCost: Number(item.estimatedCost || 0),
          })),
        }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo crear el plan de tratamiento')

      setStatus('Plan de tratamiento creado.')
      setPlanForm(initialPlanForm)
      setPlanItems([])
      setPlanItemDraft(initialPlanItemDraft)

      await loadWorkspace()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo crear el plan de tratamiento')
    } finally {
      setSavingPlan(false)
    }
  }

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Odontología' }]}
        eyebrow="Vertical piloto"
        title="Panel odontológico"
        description="Historia clínica, odontograma visual, agenda y plan de tratamiento en una misma estación clínica inicial."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/clientes">Abrir pacientes</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/onboarding">Ajustar preset</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Pacientes con ficha', value: overview?.totals.patientProfiles ?? '—', hint: 'Perfiles clínicos creados', tone: 'sky' },
          { label: 'Evoluciones', value: overview?.totals.clinicalRecords ?? '—', hint: 'Registros clínicos acumulados', tone: 'neutral' },
          { label: 'Citas activas', value: overview?.totals.scheduledAppointments ?? '—', hint: 'Agenda clínica operativa', tone: 'amber' },
          { label: 'Planes activos', value: overview?.totals.activeTreatmentPlans ?? '—', hint: 'Tratamientos en curso', tone: 'teal' },
        ]}
      />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

      <Tabs defaultValue="historia" className="space-y-4">
        <TabsList className="h-auto flex-wrap justify-start rounded-[20px] bg-slate-100 p-1.5">
          <TabsTrigger value="historia" className="rounded-2xl px-4 py-2 text-sm">Historia clínica</TabsTrigger>
          <TabsTrigger value="agenda" className="rounded-2xl px-4 py-2 text-sm">Agenda clínica</TabsTrigger>
          <TabsTrigger value="planes" className="rounded-2xl px-4 py-2 text-sm">Plan de tratamiento</TabsTrigger>
          <TabsTrigger value="alcance" className="rounded-2xl px-4 py-2 text-sm">Control total</TabsTrigger>
        </TabsList>

        <TabsContent value="historia" className="space-y-5">
          <div className="space-y-5">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Registrar evolución clínica</CardTitle>
                <CardDescription>Combina ficha básica, diagnóstico narrativo y odontograma estructurado por pieza dental.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <form className="space-y-4" onSubmit={submitRecord}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Paciente</Label>
                      <SearchableNativeSelect
                        value={recordForm.clienteId}
                        onChange={(value) => setRecordForm((current) => ({ ...current, clienteId: value }))}
                        options={clienteOptions}
                        searchClassName={nativeSearchClassName}
                        selectClassName={nativeSelectClassName}
                        searchPlaceholder="Buscar paciente..."
                        emptyText="No hay pacientes registrados"
                        includeAllOption={{ value: '', label: loading ? 'Cargando pacientes...' : 'Selecciona un paciente' }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Motivo de consulta</Label>
                      <SearchableNativeSelect
                        value={recordForm.consultationReason}
                        onChange={(value) => setRecordForm((current) => ({ ...current, consultationReason: value }))}
                        options={consultationNativeOptions}
                        searchClassName={nativeSearchClassName}
                        selectClassName={nativeSelectClassName}
                        includeAllOption={{ value: '', label: 'Selecciona un motivo' }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Fecha de atención</Label>
                      <Input type="datetime-local" value={recordForm.appointmentDate} onChange={(event) => setRecordForm((current) => ({ ...current, appointmentDate: event.target.value }))} className="h-11 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Próxima visita</Label>
                      <Input type="datetime-local" value={recordForm.nextVisitAt} onChange={(event) => setRecordForm((current) => ({ ...current, nextVisitAt: event.target.value }))} className="h-11 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado del tratamiento</Label>
                      <SearchableNativeSelect
                        value={recordForm.treatmentStatus}
                        onChange={(value) => setRecordForm((current) => ({ ...current, treatmentStatus: value }))}
                        options={treatmentNativeOptions}
                        searchClassName={nativeSearchClassName}
                        selectClassName={nativeSelectClassName}
                        includeAllOption={{ value: '', label: 'Selecciona un estado' }}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Fecha de nacimiento</Label>
                      <Input type="date" value={recordForm.birthDate} onChange={(event) => setRecordForm((current) => ({ ...current, birthDate: event.target.value }))} className="h-11 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dentición clínica</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['ADULT', 'PEDIATRIC'] as const).map((option) => (
                          <button
                            key={option}
                            type="button"
                            onClick={() => {
                              setDentitionTouched(true)
                              setRecordForm((current) => ({ ...current, dentitionType: option }))
                            }}
                            className={cn(
                              'rounded-2xl border px-3 py-3 text-left text-sm transition-all',
                              recordForm.dentitionType === option ? 'border-sky-300 bg-sky-50 text-sky-950' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                            )}
                          >
                            <div className="font-semibold">{option === 'ADULT' ? 'Adulto' : 'Infante'}</div>
                            <div className="mt-1 text-xs text-slate-500">{option === 'ADULT' ? '32 piezas permanentes' : '20 dientes de leche'}</div>
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-slate-500">Edad registrada: {patientAgeLabel}. Si no cambias este campo, el sistema sugiere la dentición según la fecha de nacimiento.</div>
                    </div>
                    <div className="space-y-2">
                      <Label>Grupo sanguíneo</Label>
                      <Input value={recordForm.bloodType} onChange={(event) => setRecordForm((current) => ({ ...current, bloodType: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: O+" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Medicamentos actuales</Label>
                      <Input value={recordForm.currentMedications} onChange={(event) => setRecordForm((current) => ({ ...current, currentMedications: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: Analgésicos" />
                    </div>
                    <div className="space-y-2">
                      <Label>Alergias</Label>
                      <Input value={recordForm.allergies} onChange={(event) => setRecordForm((current) => ({ ...current, allergies: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: Penicilina" />
                    </div>
                  </div>

                  <OdontogramChart entries={mergedOdontogramEntries} selectedToothCode={selectedToothCode} onSelectTooth={handleSelectTooth} draftEntry={selectedToothCode ? toothDraft : null} dentitionType={recordForm.dentitionType} />

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Pieza seleccionada</Label>
                        <Input value={selectedToothCode || ''} readOnly className="h-11 rounded-xl text-sm" placeholder="Haz clic en un diente" />
                      </div>
                      <div className="space-y-2">
                        <Label>Condición</Label>
                        <SearchableNativeSelect
                          value={toothDraft.condition}
                          onChange={(value) => updateToothDraft({ condition: value })}
                          options={toothConditionNativeOptions}
                          searchClassName={nativeSearchClassName}
                          selectClassName={nativeSelectClassName}
                          includeAllOption={{ value: '', label: 'Selecciona condición' }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedimiento sugerido</Label>
                        <SearchableNativeSelect
                          value={toothDraft.recommendedProcedure}
                          onChange={(value) => updateToothDraft({ recommendedProcedure: value })}
                          options={procedureNativeOptions}
                          searchClassName={nativeSearchClassName}
                          selectClassName={nativeSelectClassName}
                          includeAllOption={{ value: '', label: 'Opcional' }}
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <Button type="button" variant="outline" className="h-11 rounded-xl px-4 text-sm" onClick={() => { if (selectedToothCode) removeToothEntry(selectedToothCode) }} disabled={!selectedToothCode}>
                          Limpiar
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-xl px-4 text-sm" onClick={pushSelectedToothToPlan} disabled={!selectedToothCode || !toothDraft.recommendedProcedure}>
                          Enviar al plan
                        </Button>
                        <Button type="button" className="h-11 rounded-xl px-4 text-sm" onClick={upsertSelectedTooth} disabled={!selectedToothCode || !toothDraft.condition}>
                          Guardar pieza
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Diagnóstico por pieza</Label>
                        <Textarea value={toothDraft.diagnosis} onChange={(event) => updateToothDraft({ diagnosis: event.target.value })} className="min-h-[96px] rounded-2xl text-sm" placeholder="Ej: Caries oclusal profunda en 16." />
                      </div>
                      <div className="space-y-2">
                        <Label>Notas de la pieza</Label>
                        <Textarea value={toothDraft.notes} onChange={(event) => updateToothDraft({ notes: event.target.value })} className="min-h-[96px] rounded-2xl text-sm" placeholder="Sensibilidad, movilidad, pronóstico o superficies afectadas." />
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">Mini historial de la pieza</div>
                          <div className="text-xs text-slate-500">Cada diente muestra su propia línea de evolución según las sesiones ya guardadas.</div>
                        </div>
                        <div className="text-xs text-slate-500">{selectedToothCode ? `Pieza ${selectedToothCode}` : 'Selecciona una pieza'}</div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {!selectedToothCode ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            Haz clic en una pieza del odontograma para revisar su historial puntual.
                          </div>
                        ) : selectedToothHistory.length ? selectedToothHistory.map((item) => (
                          <div key={`${item.recordId}-${item.entry.toothCode}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-slate-950">{formatDate(item.appointmentDate)} · {normalizeClinicalLabel(item.entry.condition)}</div>
                              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">{normalizeStatusLabel(item.treatmentStatus)}</span>
                            </div>
                            <div className="mt-1 text-slate-600">{item.entry.diagnosis}</div>
                            {item.entry.recommendedProcedure || item.procedureSummary ? (
                              <div className="mt-2 text-xs text-slate-600">
                                Procedimiento: {item.entry.recommendedProcedure || item.procedureSummary}
                              </div>
                            ) : null}
                            {item.entry.notes ? <div className="mt-1 text-xs text-slate-500">Notas: {item.entry.notes}</div> : null}
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            Esta pieza aún no tiene antecedentes clínicos en sesiones previas.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Piezas registradas</div>
                        <div className="text-xs text-slate-500">Cada entrada queda guardada dentro del odontograma estructurado del registro.</div>
                      </div>
                      <div className="text-xs text-slate-500">{mergedOdontogramEntries.length} piezas</div>
                    </div>
                    <div className="space-y-2">
                      {mergedOdontogramEntries.length ? mergedOdontogramEntries.map((entry) => (
                        <div key={entry.toothCode} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                          <div>
                            <div className="font-semibold text-slate-950">Pieza {entry.toothCode} · {normalizeClinicalLabel(entry.condition)}</div>
                            <div className="text-slate-600">{entry.diagnosis}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {entry.recommendedProcedure ? <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700">{entry.recommendedProcedure}</span> : null}
                            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => removeToothEntry(entry.toothCode)}>Quitar</Button>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                          Aún no has marcado piezas en el odontograma.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Diagnóstico general</Label>
                      <Textarea value={recordForm.diagnosis} onChange={(event) => setRecordForm((current) => ({ ...current, diagnosis: event.target.value }))} className="min-h-[96px] rounded-2xl text-sm" placeholder="Síntesis clínica general del caso." />
                    </div>
                    <div className="space-y-2">
                      <Label>Procedimiento realizado</Label>
                      <Textarea value={recordForm.procedureSummary} onChange={(event) => setRecordForm((current) => ({ ...current, procedureSummary: event.target.value }))} className="min-h-[96px] rounded-2xl text-sm" placeholder="Describe lo realizado en la atención." />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Textarea value={recordForm.observations} onChange={(event) => setRecordForm((current) => ({ ...current, observations: event.target.value }))} className="min-h-[90px] rounded-2xl text-sm" placeholder="Indicaciones, educación al paciente o seguimiento." />
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">Fotos y radiografías de la sesión</div>
                        <div className="text-xs text-slate-500">Adjunta evidencia visual para esta evolución clínica. Se guardará con la sesión actual.</div>
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800">
                        {uploadingAttachment ? 'Subiendo...' : 'Agregar archivo'}
                        <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" disabled={uploadingAttachment} onChange={(event) => void uploadClinicalAttachment(event.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {recordForm.sessionAttachments.length ? recordForm.sessionAttachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)]">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="line-clamp-1 text-sm font-medium text-slate-950">{attachment.name}</p>
                              <p className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()} · {attachment.mimeType || 'Sin mime'}</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setRecordForm((current) => ({ ...current, sessionAttachments: current.sessionAttachments.filter((item) => item.id !== attachment.id) }))}>Quitar</Button>
                          </div>
                          <div className="mt-3">{renderAttachmentPreview(attachment)}</div>
                          <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                          Aún no has agregado evidencia visual a esta sesión.
                        </div>
                      )}
                    </div>
                  </div>

                  <Button type="submit" size="lg" className="rounded-2xl px-5 text-sm" disabled={savingRecord || loading}>
                    {savingRecord ? 'Guardando evolución...' : 'Guardar evolución clínica'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Historial por sesión</CardTitle>
                <CardDescription>Compara cambios del odontograma entre citas y revisa la evidencia clínica cargada por evolución.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {!recordForm.clienteId ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Selecciona un paciente para ver el historial comparativo del odontograma.
                  </div>
                ) : loadingHistory ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Cargando historial clínico...
                  </div>
                ) : selectedHistory.length ? selectedHistory.map((record, index) => {
                  const currentEntries = record.odontogram?.entries ?? []
                  const previousEntries = selectedHistory[index + 1]?.odontogram?.entries ?? []
                  const changes = diffEntries(currentEntries, previousEntries)
                  const attachments = record.odontogram?.attachments ?? []

                  return (
                    <div key={record.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">{formatDate(record.appointmentDate)} · {record.consultationReason}</div>
                          <div className="text-xs text-slate-500">{record.cliente.nombre} · {normalizeStatusLabel(record.treatmentStatus)}</div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">{currentEntries.length} piezas</span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">{attachments.length} adjuntos</span>
                        </div>
                      </div>
                      {record.diagnosis ? <div className="mt-3 text-sm text-slate-700">Diagnóstico: {record.diagnosis}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                        {currentEntries.map((entry) => (
                          <span key={`${record.id}-${entry.toothCode}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{entry.toothCode} · {normalizeClinicalLabel(entry.condition)}</span>
                        ))}
                      </div>
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Comparativo vs sesión anterior</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                          {changes.length ? changes.map((change) => (
                            <span key={`${record.id}-${change}`} className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1">{change}</span>
                          )) : <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">Sin cambios frente a la sesión previa</span>}
                        </div>
                      </div>
                      {attachments.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {attachments.map((attachment) => (
                            <div key={`${record.id}-${attachment.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                              <div className="text-sm font-medium text-slate-950">{attachment.name}</div>
                              <div className="mt-1 text-xs text-slate-500">{attachment.type.toUpperCase()}</div>
                              <div className="mt-3">{renderAttachmentPreview(attachment)}</div>
                              <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">Abrir archivo</a>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Este paciente todavía no tiene sesiones clínicas para comparar.
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="agenda" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Nueva cita odontológica</CardTitle>
                <CardDescription>Agenda paciente, sillón y duración. Esta capa ya deja lista la trazabilidad clínica por cita.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <form className="space-y-4" onSubmit={submitAppointment}>
                  <div className="space-y-2">
                    <Label>Paciente</Label>
                    <SearchableNativeSelect
                      value={appointmentForm.clienteId}
                      onChange={(value) => setAppointmentForm((current) => ({ ...current, clienteId: value }))}
                      options={clienteOptions}
                      searchClassName={nativeSearchClassName}
                      selectClassName={nativeSelectClassName}
                      searchPlaceholder="Buscar paciente..."
                      emptyText="No hay pacientes registrados"
                      includeAllOption={{ value: '', label: 'Selecciona un paciente' }}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Motivo</Label>
                      <Input value={appointmentForm.reason} onChange={(event) => setAppointmentForm((current) => ({ ...current, reason: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: Control posoperatorio" />
                    </div>
                    <div className="space-y-2">
                      <Label>Sillón / consultorio</Label>
                      <Input value={appointmentForm.chairName} onChange={(event) => setAppointmentForm((current) => ({ ...current, chairName: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: Sillón 2" />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Fecha y hora</Label>
                      <Input type="datetime-local" value={appointmentForm.startsAt} onChange={(event) => setAppointmentForm((current) => ({ ...current, startsAt: event.target.value }))} className="h-11 rounded-xl text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label>Duración</Label>
                      <Input type="number" min="15" step="15" value={appointmentForm.durationMinutes} onChange={(event) => setAppointmentForm((current) => ({ ...current, durationMinutes: event.target.value }))} className="h-11 rounded-xl text-sm" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea value={appointmentForm.notes} onChange={(event) => setAppointmentForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[96px] rounded-2xl text-sm" placeholder="Indicaciones previas, confirmación o consideraciones clínicas." />
                  </div>

                  <Button type="submit" size="lg" className="rounded-2xl px-5 text-sm" disabled={savingAppointment || loading}>
                    {savingAppointment ? 'Creando cita...' : 'Crear cita'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Agenda próxima</CardTitle>
                <CardDescription>Próximas citas odontológicas activas. El estado clínico puede crecer luego con confirmaciones y no-show.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                {overview?.upcomingAppointments.length ? overview.upcomingAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{appointment.cliente.nombre}</div>
                        <div className="text-xs text-slate-500">{appointment.cliente.documento}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">{normalizeStatusLabel(appointment.status)}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">{appointment.reason}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{formatDate(appointment.startsAt)}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Fin: {formatDate(appointment.endsAt)}</span>
                      {appointment.chairName ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{appointment.chairName}</span> : null}
                      {appointment.assignedDentist?.name || appointment.assignedDentist?.email ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Doctor: {appointment.assignedDentist?.name || appointment.assignedDentist?.email}</span>
                      ) : null}
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label className="text-xs uppercase tracking-[0.18em] text-slate-500">Cambiar estado desde la tarjeta</Label>
                      <SearchableNativeSelect
                        value={appointment.status}
                        onChange={(value) => void updateAppointmentStatus(appointment.id, value || appointment.status)}
                        options={appointmentNativeOptions}
                        searchClassName={nativeSearchClassName}
                        selectClassName={nativeSelectClassName}
                        includeAllOption={undefined}
                      />
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    No hay citas activas. Agenda la primera desde este módulo.
                  </div>
                )}

                <div className="rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
                  Estados disponibles para la agenda clínica: {appointmentStatusOptions.map((item) => item.label).join(', ')}.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="planes" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Nuevo plan de tratamiento</CardTitle>
                <CardDescription>Arma tratamientos por paciente con procedimientos, piezas involucradas y costo estimado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <form className="space-y-4" onSubmit={submitPlan}>
                  <div className="space-y-2">
                    <Label>Paciente</Label>
                    <SearchableNativeSelect
                      value={planForm.clienteId}
                      onChange={(value) => setPlanForm((current) => ({ ...current, clienteId: value }))}
                      options={clienteOptions}
                      searchClassName={nativeSearchClassName}
                      selectClassName={nativeSelectClassName}
                      searchPlaceholder="Buscar paciente..."
                      emptyText="No hay pacientes registrados"
                      includeAllOption={{ value: '', label: 'Selecciona un paciente' }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Título del plan</Label>
                    <Input value={planForm.title} onChange={(event) => setPlanForm((current) => ({ ...current, title: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: Rehabilitación inicial cuadrante superior" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Resumen diagnóstico</Label>
                      <Textarea value={planForm.diagnosisSummary} onChange={(event) => setPlanForm((current) => ({ ...current, diagnosisSummary: event.target.value }))} className="min-h-[96px] rounded-2xl text-sm" placeholder="Síntesis clínica del caso." />
                    </div>
                    <div className="space-y-2">
                      <Label>Objetivos</Label>
                      <Textarea value={planForm.objectives} onChange={(event) => setPlanForm((current) => ({ ...current, objectives: event.target.value }))} className="min-h-[96px] rounded-2xl text-sm" placeholder="Objetivo funcional, estético o preventivo." />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm">
                      <div>
                        <div className="font-semibold text-emerald-950">Conexión automática con el plan</div>
                        <div className="mt-1 text-emerald-800">
                          Las piezas con procedimiento sugerido pueden convertirse en tratamientos presupuestados sin volver a digitar procedimiento ni costo base.
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">Sugeridos</div>
                        <div className="mt-1 font-semibold text-emerald-950">{suggestedPlanItems.length} items · {formatMoney(suggestedPlanTotal)}</div>
                      </div>
                    </div>
                    <div className="mb-3 text-sm font-semibold text-slate-950">Agregar procedimiento</div>
                    <div className="mb-4 flex flex-wrap gap-3">
                      <Button type="button" variant="outline" className="rounded-2xl px-4 text-sm" onClick={importSuggestedProceduresToPlan} disabled={!suggestedPlanItems.length}>
                        Importar desde evolución actual
                      </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Pieza</Label>
                        <Input value={planItemDraft.toothCode} onChange={(event) => setPlanItemDraft((current) => ({ ...current, toothCode: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="Ej: 16" />
                      </div>
                      <div className="space-y-2">
                        <Label>Procedimiento</Label>
                        <SearchableNativeSelect
                          value={planItemDraft.procedureType}
                          onChange={(value) => setPlanItemDraft((current) => ({
                            ...current,
                            procedureType: value,
                            estimatedCost: value ? String(getSuggestedProcedureCost(procedureOptions, value) || Number(current.estimatedCost || 0) || '') : current.estimatedCost,
                          }))}
                          options={procedureNativeOptions}
                          searchClassName={nativeSearchClassName}
                          selectClassName={nativeSelectClassName}
                          includeAllOption={{ value: '', label: 'Selecciona' }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Costo estimado</Label>
                        <Input type="number" min="0" value={planItemDraft.estimatedCost} onChange={(event) => setPlanItemDraft((current) => ({ ...current, estimatedCost: event.target.value }))} className="h-11 rounded-xl text-sm" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha sugerida</Label>
                        <Input type="datetime-local" value={planItemDraft.scheduledAt} onChange={(event) => setPlanItemDraft((current) => ({ ...current, scheduledAt: event.target.value }))} className="h-11 rounded-xl text-sm" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label>Descripción</Label>
                      <Textarea value={planItemDraft.description} onChange={(event) => setPlanItemDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-[80px] rounded-2xl text-sm" placeholder="Detalle del procedimiento y alcance." />
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Al escoger un procedimiento cargamos el costo base sembrado para odontología. Puedes ajustarlo antes de guardar el plan.
                    </div>
                    <div className="mt-4">
                      <Button type="button" variant="outline" className="rounded-2xl px-4 text-sm" onClick={addPlanItem}>Agregar al plan</Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notas del plan</Label>
                    <Textarea value={planForm.notes} onChange={(event) => setPlanForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-[90px] rounded-2xl text-sm" placeholder="Condiciones, fases o consideraciones del tratamiento." />
                  </div>

                  <div className="space-y-2">
                    {planItems.length ? planItems.map((item, index) => (
                      <div key={`${item.toothCode || 'general'}-${item.procedureType}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm">
                        <div>
                          <div className="font-semibold text-slate-950">{item.procedureType} {item.toothCode ? `· Pieza ${item.toothCode}` : '· General'}</div>
                          <div className="text-slate-600">{item.description || 'Sin descripción adicional'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">{formatMoney(Number(item.estimatedCost || 0))}</span>
                          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => setPlanItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Quitar</Button>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                        Aún no has agregado procedimientos al plan.
                      </div>
                    )}
                  </div>

                  <Button type="submit" size="lg" className="rounded-2xl px-5 text-sm" disabled={savingPlan || loading}>
                    {savingPlan ? 'Creando plan...' : 'Guardar plan de tratamiento'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Planes activos</CardTitle>
                <CardDescription>Seguimiento rápido de tratamientos vigentes con costo estimado y volumen de procedimientos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6">
                {overview?.treatmentPlans.length ? overview.treatmentPlans.map((plan) => (
                  <div key={plan.id} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{plan.title}</div>
                        <div className="text-xs text-slate-500">{plan.cliente.nombre} · {plan.cliente.documento}</div>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">{normalizeStatusLabel(plan.status)}</span>
                    </div>
                    {plan.diagnosisSummary ? <div className="mt-3 text-sm text-slate-700">{plan.diagnosisSummary}</div> : null}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{plan._count.items} procedimientos</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{plan._count.appointments} citas vinculadas</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{formatMoney(plan.estimatedTotal)}</span>
                    </div>
                    {plan.items.length ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {plan.items.map((item) => (
                          <span key={item.id} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">{item.procedureType}{item.toothCode ? ` · ${item.toothCode}` : ''}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                    Aún no hay planes activos. Crea el primero desde este módulo.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alcance" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Lo que ya cubre este vertical</CardTitle>
                <CardDescription>Este bloque deja la operación clínica base realmente usable para un odontólogo general.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6 text-sm text-slate-700">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">Pacientes reutilizando la base de clientes con ficha clínica odontológica.</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">Historia clínica con evolución, diagnóstico narrativo, próxima visita y odontograma estructurado por pieza.</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">Agenda clínica con cita, horario, duración, responsable y vínculo futuro al tratamiento.</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">Plan de tratamiento con procedimientos por pieza, costo estimado y seguimiento operativo.</div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">Seeds por empresa para catálogos clínicos: motivos, estados, procedimientos y condiciones dentales.</div>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
              <CardHeader className="border-b border-slate-100 pb-5">
                <CardTitle className="text-2xl text-slate-950">Lo que requiere control total</CardTitle>
                <CardDescription>Estas son las capas siguientes para convertirlo en una gestión odontológica completa, no solo un piloto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-6 text-sm text-slate-700">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Consentimientos informados, anexos firmados y documentos por procedimiento.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Adjuntos clínicos: radiografías, fotografías intraorales, PDFs y comparativos por evolución.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Presupuestos aprobables, abonos, cartera del tratamiento y conciliación con caja/contabilidad.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Recordatorios automáticos, confirmación de asistencia, cancelación y no-show con canal WhatsApp/email.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Especialidades: ortodoncia, implantología, periodoncia, odontopediatría y evolución por fases.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">Indicadores del consultorio: ocupación por sillón, aceptación de planes, producción por doctor y recaudo.</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function buildPlanItemKey(item: { toothCode: string | null; procedureType: string }) {
  return `${item.toothCode || 'general'}::${item.procedureType.trim().toUpperCase()}`
}

function getSuggestedProcedureCost(options: DropdownOption[], procedureType: string) {
  const match = options.find((item) => item.value === procedureType)
  const value = match?.meta?.suggestedCostCOP
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function buildPlanItemFromOdontogramEntry(entry: OdontogramEntry, procedureOptions: DropdownOption[]): PlanItemDraft | null {
  if (!entry.recommendedProcedure) return null

  const estimatedCost = getSuggestedProcedureCost(procedureOptions, entry.recommendedProcedure)

  return {
    toothCode: entry.toothCode,
    procedureType: entry.recommendedProcedure,
    description: entry.notes || entry.diagnosis,
    estimatedCost: estimatedCost ? String(estimatedCost) : '',
    scheduledAt: '',
  }
}