'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Boxes, ClipboardCheck, PackageCheck, Plus, ShieldCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableNativeSelect, type SearchableNativeSelectOption } from '@/components/ui/searchable-native-select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type DotacionesCliente = {
	id: string
	nombre: string
	documento: string
	sedeId: string | null
	sede: { nombre: string } | null
}

type DotacionesSede = {
	id: string
	nombre: string
	codigo: string | null
}

type DotacionesEmployee = {
	id: string
	sedeId: string
	code: string
	fullName: string
	role: string
	documentNumber: string
	status: string
	sede: string
}

type DotacionesMaterial = {
	id: string
	externalId: string | null
	nombre: string
	categoria: string | null
	color: string | null
	unidadMedida: string
	stockActual: number
}

type DotacionesWarehouse = {
	id: string
	nombre: string
	codigo: string | null
	sedeId: string | null
	isDefault: boolean
	sede: { nombre: string } | null
}

type RecentRemision = {
	id: string
	numero: string
	status: string
	clienteNombre: string | null
	note: string | null
	createdAt: string
	warehouse: { id: string; nombre: string } | null
	items: Array<{
		id: string
		quantity: number
		note: string | null
		material: { id: string; nombre: string; unidadMedida: string }
	}>
}

type DotacionPedidoItemStatus = 'PENDIENTE' | 'REMITIDA' | 'CANCELADA'
type DotacionPedidoStatus = 'BORRADOR' | 'EN_PREPARACION' | 'ENTREGA_PARCIAL' | 'ENTREGADA' | 'CANCELADA'

type SavedPedidoItem = {
	id: string
	employeeId: string | null
	employeeName: string | null
	sedeId: string | null
	sedeName: string | null
	materialId: string | null
	materialName: string | null
	talla: string | null
	color: string | null
	quantity: number
	note: string | null
	selected: boolean
	status: DotacionPedidoItemStatus
	deliveredAt: string | null
	remisionId: string | null
	remisionNumero: string | null
}

type SavedPedido = {
	id: string
	clienteId: string | null
	clienteNombre: string | null
	cotizacionId: string | null
	cotizacionNumero: string | null
	warehouseId: string | null
	title: string | null
	batchNote: string | null
	status: DotacionPedidoStatus
	updatedAt: string
	itemCount: number
	deliveredCount: number
	pendingCount: number
	items: SavedPedidoItem[]
}

type ApprovedCotizacion = {
	id: string
	numero: string
	createdAt: string
	total: number
	observaciones: string | null
	clienteId: string
	cliente: {
		nombre: string
		documento: string
		sedeId: string | null
		sede: { nombre: string } | null
	}
	items: Array<{
		id: string
		descripcion: string
		cantidad: number
		unidad: string
		observaciones: string | null
		materialId: string | null
		material: { id: string; nombre: string; color: string | null; unidadMedida: string } | null
	}>
}

type OverviewResponse = {
	currentSedeId: string
	clientes: DotacionesCliente[]
	sedes: DotacionesSede[]
	employees: DotacionesEmployee[]
	materials: DotacionesMaterial[]
	warehouses: DotacionesWarehouse[]
	recentRemisiones: RecentRemision[]
	activePedido: SavedPedido | null
	recentPedidos: SavedPedido[]
	approvedCotizaciones: ApprovedCotizacion[]
}

type PlannerRow = {
	id: string
	itemId: string | null
	employeeId: string
	employeeName: string
	sedeId: string
	sedeName: string
	materialId: string
	materialName: string
	talla: string
	color: string
	quantity: string
	note: string
	selected: boolean
	deliveryStatus: DotacionPedidoItemStatus
	deliveredAt: string | null
	remisionId: string | null
	remisionNumero: string | null
}

const LANES = [
	{
		title: 'Cotizar pedidos corporativos',
		description: 'Arma propuestas para uniformes, EPP y kits empresariales con margen visible desde el inicio.',
		href: '/dashboard/cotizador',
		cta: 'Ir al cotizador',
		icon: ClipboardCheck,
	},
	{
		title: 'Seguir aprobaciones',
		description: 'Concentra cotizaciones aprobadas, pendientes y próximas acciones comerciales del pedido.',
		href: '/dashboard/cotizaciones',
		cta: 'Ver cotizaciones',
		icon: ShieldCheck,
	},
	{
		title: 'Asegurar abastecimiento',
		description: 'Revisa compras, proveedores e inventario para no comprometer entregas sin stock ni reposición.',
		href: '/dashboard/compras',
		cta: 'Abrir compras',
		icon: Boxes,
	},
	{
		title: 'Despachar y soportar entrega',
		description: 'Emite remisiones y deja trazabilidad para entregas parciales, completas o por sede.',
		href: '/dashboard/remisiones',
		cta: 'Abrir remisiones',
		icon: Truck,
	},
] as const

const CHECKLIST = [
	'Definir líneas base: uniformes, calzado, EPP y kits por cliente.',
	'Separar inventario comprometido vs disponible antes de aprobar un pedido.',
	'Usar remisiones para entregas por tallas, sedes o cortes parciales.',
	'Mantener compras y proveedores alineados con fechas pactadas de entrega.',
]

function makeRow(seed?: Partial<PlannerRow>): PlannerRow {
	return {
		id: crypto.randomUUID(),
		itemId: null,
		employeeId: '',
		employeeName: '',
		sedeId: '',
		sedeName: '',
		materialId: '',
		materialName: '',
		talla: '',
		color: '',
		quantity: '1',
		note: '',
		selected: true,
		deliveryStatus: 'PENDIENTE',
		deliveredAt: null,
		remisionId: null,
		remisionNumero: null,
		...seed,
	}
}

function mapSavedItemToPlannerRow(item: SavedPedidoItem): PlannerRow {
	return makeRow({
		itemId: item.id,
		employeeId: item.employeeId || '',
		employeeName: item.employeeName || '',
		sedeId: item.sedeId || '',
		sedeName: item.sedeName || '',
		materialId: item.materialId || '',
		materialName: item.materialName || '',
		talla: item.talla || '',
		color: item.color || '',
		quantity: String(item.quantity || 1),
		note: item.note || '',
		selected: item.selected,
		deliveryStatus: item.status,
		deliveredAt: item.deliveredAt,
		remisionId: item.remisionId,
		remisionNumero: item.remisionNumero,
	})
}

function formatDate(value: string) {
	try {
		return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
	} catch {
		return value
	}
}

function formatNumber(value: number) {
	return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value)
}

function toNativeOptions<T extends { id: string; label: string }>(rows: T[]): SearchableNativeSelectOption[] {
	return rows.map((row) => ({ value: row.id, label: row.label }))
}

function hasDraftContent(rows: PlannerRow[], opts: { clienteId: string; cotizacionId: string; warehouseId: string; batchNote: string }) {
	if (opts.clienteId || opts.cotizacionId || opts.warehouseId || opts.batchNote.trim()) return true
	return rows.some((row) => Boolean(row.employeeId || row.materialId || row.talla || row.color || row.note.trim() || Number(row.quantity) > 1))
}

function getPedidoStatusMeta(status: DotacionPedidoStatus | null) {
	switch (status) {
		case 'ENTREGADA':
			return { label: 'Entregada', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
		case 'ENTREGA_PARCIAL':
			return { label: 'Entrega parcial', className: 'border-amber-200 bg-amber-50 text-amber-700' }
		case 'EN_PREPARACION':
			return { label: 'En preparación', className: 'border-sky-200 bg-sky-50 text-sky-700' }
		case 'CANCELADA':
			return { label: 'Cancelada', className: 'border-rose-200 bg-rose-50 text-rose-700' }
		case 'BORRADOR':
		default:
			return { label: 'Borrador', className: 'border-slate-200 bg-slate-50 text-slate-700' }
	}
}

export default function DotacionesClient() {
	const [overview, setOverview] = useState<OverviewResponse | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [status, setStatus] = useState<string | null>(null)

	const [clienteId, setClienteId] = useState('')
	const [cotizacionId, setCotizacionId] = useState('')
	const [warehouseId, setWarehouseId] = useState('')
	const [batchNote, setBatchNote] = useState('')
	const [plannerRows, setPlannerRows] = useState<PlannerRow[]>([])

	const [currentPedidoId, setCurrentPedidoId] = useState<string | null>(null)
	const [currentPedidoStatus, setCurrentPedidoStatus] = useState<DotacionPedidoStatus | null>(null)
	const [savingPedido, setSavingPedido] = useState(false)
	const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
	const [savingRemision, setSavingRemision] = useState(false)

	const [filterClienteId, setFilterClienteId] = useState('')
	const [filterSedeId, setFilterSedeId] = useState('')
	const [filterStatus, setFilterStatus] = useState('')

	const skipAutosaveRef = useRef(false)

	const clienteOptions = useMemo(
		() => toNativeOptions((overview?.clientes ?? []).map((cliente) => ({ id: cliente.id, label: `${cliente.nombre} · ${cliente.documento}` }))),
		[overview?.clientes],
	)
	const employeeOptions = useMemo(
		() => toNativeOptions((overview?.employees ?? []).map((employee) => ({ id: employee.id, label: `${employee.fullName} · ${employee.role} · ${employee.sede}` }))),
		[overview?.employees],
	)
	const materialOptions = useMemo(
		() => toNativeOptions((overview?.materials ?? []).map((material) => ({ id: material.id, label: `${material.nombre} · Stock ${formatNumber(material.stockActual)}` }))),
		[overview?.materials],
	)
	const warehouseOptions = useMemo(
		() => toNativeOptions((overview?.warehouses ?? []).map((warehouse) => ({ id: warehouse.id, label: `${warehouse.nombre}${warehouse.sede ? ` · ${warehouse.sede.nombre}` : ''}` }))),
		[overview?.warehouses],
	)
	const approvedCotizacionOptions = useMemo(
		() => toNativeOptions((overview?.approvedCotizaciones ?? []).map((cotizacion) => ({ id: cotizacion.id, label: `${cotizacion.numero} · ${cotizacion.cliente.nombre}` }))),
		[overview?.approvedCotizaciones],
	)

	const employeeById = useMemo(() => new Map((overview?.employees ?? []).map((employee) => [employee.id, employee])), [overview?.employees])
	const materialById = useMemo(() => new Map((overview?.materials ?? []).map((material) => [material.id, material])), [overview?.materials])
	const sedeById = useMemo(() => new Map((overview?.sedes ?? []).map((sede) => [sede.id, sede])), [overview?.sedes])
	const selectedCliente = useMemo(() => (overview?.clientes ?? []).find((cliente) => cliente.id === clienteId) ?? null, [overview?.clientes, clienteId])
	const selectedApprovedCotizacion = useMemo(() => (overview?.approvedCotizaciones ?? []).find((cotizacion) => cotizacion.id === cotizacionId) ?? null, [overview?.approvedCotizaciones, cotizacionId])

	const selectedRows = useMemo(
		() => plannerRows.filter((row) => row.selected && row.employeeId && row.materialId && Number(row.quantity) > 0 && row.deliveryStatus !== 'REMITIDA'),
		[plannerRows],
	)
	const rowsBySede = useMemo(() => {
		const groups = new Map<string, { sedeName: string; count: number }>()
		for (const row of plannerRows) {
			if (!row.sedeId) continue
			const sedeName = row.sedeName || sedeById.get(row.sedeId)?.nombre || 'Sin sede'
			const current = groups.get(row.sedeId) ?? { sedeName, count: 0 }
			current.count += 1
			groups.set(row.sedeId, current)
		}
		return Array.from(groups.entries()).map(([sedeId, value]) => ({ sedeId, ...value }))
	}, [plannerRows, sedeById])
	const groupedSelectedSummary = useMemo(() => {
		const groups = new Map<string, { label: string; quantity: number; rows: number }>()
		for (const row of selectedRows) {
			const material = materialById.get(row.materialId)
			const sede = sedeById.get(row.sedeId)
			const label = `${material?.nombre ?? row.materialName ?? 'Material'} · ${sede?.nombre ?? row.sedeName ?? 'Sin sede'} · ${row.color || 'Sin color'} · ${row.talla || 'Sin talla'}`
			const current = groups.get(label) ?? { label, quantity: 0, rows: 0 }
			current.quantity += Number(row.quantity || 0)
			current.rows += 1
			groups.set(label, current)
		}
		return Array.from(groups.values())
	}, [selectedRows, materialById, sedeById])
	const filteredPedidos = useMemo(() => {
		return (overview?.recentPedidos ?? []).filter((pedido) => {
			if (filterClienteId && pedido.clienteId !== filterClienteId) return false
			if (filterStatus && pedido.status !== filterStatus) return false
			if (filterSedeId && !pedido.items.some((item) => item.sedeId === filterSedeId)) return false
			return true
		})
	}, [filterClienteId, filterSedeId, filterStatus, overview?.recentPedidos])

	function hydrateFromPedido(pedido: SavedPedido | null, fallbackWarehouseId?: string) {
		skipAutosaveRef.current = true
		setCurrentPedidoId(pedido?.id ?? null)
		setCurrentPedidoStatus(pedido?.status ?? null)
		setClienteId(pedido?.clienteId ?? '')
		setCotizacionId(pedido?.cotizacionId ?? '')
		setWarehouseId(pedido?.warehouseId ?? fallbackWarehouseId ?? '')
		setBatchNote(pedido?.batchNote ?? '')
		setPlannerRows(pedido?.items.length ? pedido.items.map(mapSavedItemToPlannerRow) : [makeRow()])
	}

	function upsertPedidoInOverview(pedido: SavedPedido) {
		setOverview((current) => {
			if (!current) return current
			const recentPedidos = [pedido, ...current.recentPedidos.filter((item) => item.id !== pedido.id)].slice(0, 12)
			const activePedido = pedido.status === 'ENTREGADA' || pedido.status === 'CANCELADA'
				? current.activePedido?.id === pedido.id ? null : current.activePedido
				: pedido
			return { ...current, activePedido, recentPedidos }
		})
	}

	function prependRemision(remision: RecentRemision) {
		setOverview((current) => current ? { ...current, recentRemisiones: [remision, ...current.recentRemisiones.filter((item) => item.id !== remision.id)].slice(0, 8) } : current)
	}

	useEffect(() => {
		let cancelled = false

		async function load() {
			setLoading(true)
			setError(null)

			try {
				const response = await fetch('/api/dotaciones/overview', { cache: 'no-store' })
				const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: OverviewResponse; error?: string } | null
				if (!response.ok || !json?.ok || !json.data) {
					throw new Error(json?.error || 'No se pudo cargar el panel de dotaciones')
				}
				if (cancelled) return

				setOverview(json.data)
				const defaultWarehouseId = json.data.warehouses.find((item) => item.isDefault)?.id ?? json.data.warehouses[0]?.id ?? ''
				hydrateFromPedido(json.data.activePedido, defaultWarehouseId)
			} catch (loadError) {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el panel de dotaciones')
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		void load()
		return () => { cancelled = true }
	}, [])

	async function persistPedido(overrides?: { rows?: PlannerRow[]; pedidoId?: string | null; clienteId?: string; cotizacionId?: string; warehouseId?: string; batchNote?: string; silent?: boolean }) {
		const nextRows = overrides?.rows ?? plannerRows
		const nextPedidoId = overrides?.pedidoId ?? currentPedidoId
		const nextClienteId = overrides?.clienteId ?? clienteId
		const nextCotizacionId = overrides?.cotizacionId ?? cotizacionId
		const nextWarehouseId = overrides?.warehouseId ?? warehouseId
		const nextBatchNote = overrides?.batchNote ?? batchNote

		if (!hasDraftContent(nextRows, { clienteId: nextClienteId, cotizacionId: nextCotizacionId, warehouseId: nextWarehouseId, batchNote: nextBatchNote })) {
			return null
		}

		setSavingPedido(true)
		setAutosaveState('saving')

		try {
			const response = await fetch('/api/dotaciones/pedidos', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: nextPedidoId,
					clienteId: nextClienteId || null,
					cotizacionId: nextCotizacionId || null,
					warehouseId: nextWarehouseId || null,
					batchNote: nextBatchNote || null,
					rows: nextRows.map((row) => ({
						employeeId: row.employeeId || null,
						employeeName: row.employeeName || employeeById.get(row.employeeId)?.fullName || null,
						sedeId: row.sedeId || null,
						sedeName: row.sedeName || sedeById.get(row.sedeId)?.nombre || null,
						materialId: row.materialId || null,
						materialName: row.materialName || materialById.get(row.materialId)?.nombre || null,
						talla: row.talla || null,
						color: row.color || null,
						quantity: Number(row.quantity || 0),
						note: row.note || null,
						selected: row.selected,
						status: row.deliveryStatus,
						deliveredAt: row.deliveredAt,
						remisionId: row.remisionId,
						remisionNumero: row.remisionNumero,
					})),
				}),
			})

			const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: SavedPedido; error?: string } | null
			if (!response.ok || !json?.ok || !json.data) {
				throw new Error(json?.error || 'No se pudo guardar el lote de dotación')
			}

			skipAutosaveRef.current = true
			setCurrentPedidoId(json.data.id)
			setCurrentPedidoStatus(json.data.status)
			setClienteId(json.data.clienteId ?? '')
			setCotizacionId(json.data.cotizacionId ?? '')
			setWarehouseId(json.data.warehouseId ?? '')
			setBatchNote(json.data.batchNote ?? '')
			setPlannerRows(json.data.items.length ? json.data.items.map(mapSavedItemToPlannerRow) : [makeRow()])
			upsertPedidoInOverview(json.data)
			setAutosaveState('saved')
			if (!overrides?.silent) {
				setStatus(`Lote ${json.data.title || json.data.id} guardado con ${json.data.itemCount} ficha(s).`)
			}
			return json.data
		} catch (saveError) {
			setAutosaveState('error')
			if (!overrides?.silent) {
				setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el lote de dotación')
			}
			return null
		} finally {
			setSavingPedido(false)
		}
	}

	useEffect(() => {
		if (loading) return
		if (skipAutosaveRef.current) {
			skipAutosaveRef.current = false
			return
		}
		if (!hasDraftContent(plannerRows, { clienteId, cotizacionId, warehouseId, batchNote })) return

		const timer = window.setTimeout(() => {
			void persistPedido({ silent: true })
		}, 900)

		return () => window.clearTimeout(timer)
	}, [plannerRows, clienteId, cotizacionId, warehouseId, batchNote, loading])

	function addRow(seed?: Partial<PlannerRow>) {
		setPlannerRows((current) => [...current, makeRow(seed)])
	}

	function updateRow(rowId: string, patch: Partial<PlannerRow>) {
		setPlannerRows((current) => current.map((row) => {
			if (row.id !== rowId) return row
			const next = { ...row, ...patch }

			if (patch.employeeId !== undefined) {
				if (patch.employeeId) {
					const employee = employeeById.get(patch.employeeId)
					if (employee) {
						next.employeeName = employee.fullName
						next.sedeId = employee.sedeId
						next.sedeName = employee.sede
					}
				} else {
					next.employeeName = ''
					next.sedeId = ''
					next.sedeName = ''
				}
			}

			if (patch.materialId !== undefined) {
				if (patch.materialId) {
					const material = materialById.get(patch.materialId)
					if (material) {
						next.materialName = material.nombre
						if (!next.color) next.color = material.color || ''
					}
				} else {
					next.materialName = ''
				}
			}

			return next
		}))
	}

	function removeRow(rowId: string) {
		setPlannerRows((current) => current.length === 1 ? [makeRow()] : current.filter((row) => row.id !== rowId))
	}

	function selectRowsForCurrentCliente() {
		if (!clienteId) {
			setError('Selecciona primero el cliente para marcar las fichas del lote.')
			return
		}
		setPlannerRows((current) => current.map((row) => ({ ...row, selected: row.deliveryStatus !== 'REMITIDA' && Boolean(row.employeeId && row.materialId) })))
	}

	function selectRowsForSede(sedeId: string) {
		setPlannerRows((current) => current.map((row) => ({ ...row, selected: row.deliveryStatus !== 'REMITIDA' && row.sedeId === sedeId && Boolean(row.employeeId && row.materialId) })))
	}

	function resetToNewDraft() {
		skipAutosaveRef.current = true
		setCurrentPedidoId(null)
		setCurrentPedidoStatus('BORRADOR')
		setClienteId('')
		setCotizacionId('')
		setBatchNote('')
		setPlannerRows([makeRow()])
		setStatus('Nuevo lote listo para planear.')
	}

	function loadPedidoIntoPlanner(pedido: SavedPedido) {
		hydrateFromPedido(pedido, warehouseId)
		setStatus(`Lote ${pedido.title || pedido.id} cargado en el editor.`)
	}

	function importApprovedCotizacion(nextCotizacionId: string) {
		setCotizacionId(nextCotizacionId)
		if (!nextCotizacionId) return

		const cotizacion = (overview?.approvedCotizaciones ?? []).find((item) => item.id === nextCotizacionId)
		if (!cotizacion) return

		const importedRows = cotizacion.items.length
			? cotizacion.items.map((item) => makeRow({
					materialId: item.materialId || item.material?.id || '',
					materialName: item.material?.nombre || '',
					sedeId: cotizacion.cliente.sedeId || overview?.currentSedeId || '',
					sedeName: cotizacion.cliente.sede?.nombre || '',
					color: item.material?.color || '',
					quantity: String(Math.max(1, Number(item.cantidad) || 1)),
					note: [item.descripcion, item.observaciones].filter(Boolean).join(' · '),
				}))
			: [makeRow()]

		skipAutosaveRef.current = true
		setCurrentPedidoId(null)
		setCurrentPedidoStatus('BORRADOR')
		setClienteId(cotizacion.clienteId)
		setBatchNote(cotizacion.observaciones || `Precargado desde ${cotizacion.numero}`)
		setPlannerRows(importedRows)
		setStatus(`Cotización ${cotizacion.numero} precargada. Completa empleado, talla y detalles antes de remitir.`)
	}

	function handleClienteChange(value: string) {
		setClienteId(value)
		if (cotizacionId && selectedApprovedCotizacion?.clienteId && selectedApprovedCotizacion.clienteId !== value) {
			setCotizacionId('')
		}
	}

	async function emitPartialRemision() {
		if (!selectedRows.length) {
			setError('Selecciona al menos una ficha completa para emitir la remisión parcial.')
			return
		}

		if (!warehouseId) {
			setError('Selecciona una bodega de salida para emitir la remisión.')
			return
		}

		setSavingRemision(true)
		setError(null)
		setStatus(null)

		try {
			const response = await fetch('/api/remisiones', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					warehouseId,
					clienteNombre: selectedCliente?.nombre || selectedApprovedCotizacion?.cliente.nombre || null,
					note: batchNote.trim() || `Entrega parcial de dotaciones${selectedCliente ? ` · ${selectedCliente.nombre}` : ''}`,
					items: selectedRows.map((row) => {
						const employee = employeeById.get(row.employeeId)
						const sede = sedeById.get(row.sedeId)
						const material = materialById.get(row.materialId)
						return {
							materialId: row.materialId,
							quantity: Number(row.quantity || 0),
							note: [
								employee ? `Empleado: ${employee.fullName}` : row.employeeName ? `Empleado: ${row.employeeName}` : null,
								sede ? `Sede: ${sede.nombre}` : row.sedeName ? `Sede: ${row.sedeName}` : null,
								row.talla ? `Talla: ${row.talla}` : null,
								row.color ? `Color: ${row.color}` : material?.color ? `Color base: ${material.color}` : null,
								row.note ? `Detalle: ${row.note}` : null,
							].filter(Boolean).join(' · '),
						}
					}),
				}),
			})

			const json = (await response.json().catch(() => null)) as { success?: boolean; data?: RecentRemision; error?: string } | null
			if (!response.ok || !json?.success || !json.data) {
				throw new Error(json?.error || 'No se pudo emitir la remisión parcial')
			}

			const deliveredAt = new Date().toISOString()
			const nextRows = plannerRows.map((row) => row.selected && row.employeeId && row.materialId && row.deliveryStatus !== 'REMITIDA'
				? {
						...row,
						selected: false,
						deliveryStatus: 'REMITIDA' as const,
						deliveredAt,
						remisionId: json.data?.id || null,
						remisionNumero: json.data?.numero || null,
					}
				: row)

			setPlannerRows(nextRows)
			prependRemision(json.data)
			const savedPedido = await persistPedido({ rows: nextRows, silent: true })
			setCurrentPedidoStatus(savedPedido?.status ?? currentPedidoStatus)
			setStatus(`Remisión ${json.data.numero} emitida con ${selectedRows.length} ficha(s) de dotación.`)
			setBatchNote('')
		} catch (submitError) {
			setError(submitError instanceof Error ? submitError.message : 'No se pudo emitir la remisión parcial')
		} finally {
			setSavingRemision(false)
		}
	}

	const currentStatusMeta = getPedidoStatusMeta(currentPedidoStatus)

	return (
		<div className="space-y-6 pb-6">
			<ErpPageHero
				breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Dotaciones' }]}
				eyebrow="Vertical SGDigital"
				title="Panel de dotaciones"
				description="Un frente operativo para cotizar, planear dotaciones por empleado y emitir entregas parciales con trazabilidad por sede."
				actions={
					<>
						<Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
							<Link href="/dashboard/cotizador">Nueva cotización</Link>
						</Button>
						<Button asChild className="rounded-2xl">
							<Link href="/dashboard/remisiones">Preparar entrega</Link>
						</Button>
					</>
				}
				stats={[
					{ label: 'Clientes', value: overview?.clientes.length ?? '—', hint: 'Cuentas disponibles para pedidos corporativos', tone: 'sky' },
					{ label: 'Empleados', value: overview?.employees.length ?? '—', hint: 'Fichas reutilizables para dotación por persona', tone: 'amber' },
					{ label: 'Referencias', value: overview?.materials.length ?? '—', hint: 'Materiales activos para uniformes y kits', tone: 'teal' },
					{ label: 'Lotes', value: overview?.recentPedidos.length ?? '—', hint: 'Borradores y entregas persistidas por sede', tone: 'neutral' },
				]}
			/>

			{error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
			{status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

			<div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
				<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
					<CardHeader className="border-b border-slate-100 pb-5">
						<CardTitle className="text-2xl text-slate-950">Ruta operativa del nicho</CardTitle>
						<CardDescription>Este panel pone primero lo que sí mueve una operación de dotaciones: pedido, abastecimiento y entrega.</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-4 p-6 md:grid-cols-2">
						{LANES.map((lane) => {
							const Icon = lane.icon
							return (
								<Link key={lane.href} href={lane.href} className="group rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5 transition-all hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_18px_40px_-28px_rgba(14,165,233,0.35)]">
									<div className="flex items-start justify-between gap-3">
										<div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/70 bg-sky-50 text-sky-900 shadow-sm">
											<Icon className="h-6 w-6" />
										</div>
										<ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-sky-700" />
									</div>
									<div className="mt-4 text-lg font-semibold text-slate-950">{lane.title}</div>
									<div className="mt-2 text-sm leading-6 text-slate-600">{lane.description}</div>
									<div className="mt-4 text-sm font-medium text-sky-700">{lane.cta}</div>
								</Link>
							)
						})}
					</CardContent>
				</Card>

				<div className="space-y-5">
					<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
						<CardHeader className="border-b border-slate-100 pb-5">
							<CardTitle className="text-2xl text-slate-950">Checklist de arranque</CardTitle>
							<CardDescription>Prácticas base para que el nicho opere con control desde el primer día.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 p-6">
							{CHECKLIST.map((item) => (
								<div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{item}</div>
							))}
						</CardContent>
					</Card>

					<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
						<CardHeader className="border-b border-slate-100 pb-5">
							<CardTitle className="text-2xl text-slate-950">Accesos rápidos</CardTitle>
							<CardDescription>Entradas directas a las vistas que más se usan en operaciones de dotaciones.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 p-6">
							{[
								{ label: 'Clientes corporativos', href: '/dashboard/clientes' },
								{ label: 'Inventario', href: '/dashboard/inventario' },
								{ label: 'Proveedores', href: '/dashboard/proveedores' },
								{ label: 'Compras', href: '/dashboard/compras' },
							].map((item) => (
								<Link key={item.href} href={item.href} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 transition hover:border-sky-300 hover:text-sky-800">
									<span>{item.label}</span>
									<PackageCheck className="h-4 w-4" />
								</Link>
							))}
						</CardContent>
					</Card>
				</div>
			</div>

			<div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
				<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
					<CardHeader className="border-b border-slate-100 pb-5">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<CardTitle className="text-2xl text-slate-950">Fichas masivas de dotación</CardTitle>
								<CardDescription>Registra talla, color, sede y empleado por fila, con guardado automático y carga de lotes persistidos.</CardDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<span className={cn('rounded-full border px-3 py-1 text-xs font-medium', currentStatusMeta.className)}>{currentStatusMeta.label}</span>
								<span className={cn('rounded-full border px-3 py-1 text-xs font-medium', autosaveState === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : autosaveState === 'saving' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-700')}>
									{savingPedido ? 'Guardando...' : autosaveState === 'saved' ? 'Guardado' : autosaveState === 'error' ? 'Error al guardar' : 'Sin cambios'}
								</span>
								<Button type="button" variant="outline" className="rounded-2xl" disabled={savingPedido} onClick={() => void persistPedido()}>
									Guardar ahora
								</Button>
								<Button type="button" variant="outline" className="rounded-2xl" onClick={resetToNewDraft}>
									Nuevo lote
								</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-5 p-6">
						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Precargar desde cotización aprobada</Label>
								<SearchableNativeSelect
									value={cotizacionId}
									onChange={(value) => importApprovedCotizacion(value)}
									options={approvedCotizacionOptions}
									searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
									selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
									searchPlaceholder="Buscar cotización aprobada..."
									emptyText={loading ? 'Cargando cotizaciones...' : 'No hay cotizaciones aprobadas'}
									includeAllOption={{ value: '', label: 'Selecciona cotización aprobada' }}
								/>
							</div>
							<div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
								{selectedApprovedCotizacion ? (
									<>
										<div className="font-semibold text-slate-950">{selectedApprovedCotizacion.numero}</div>
										<div className="mt-1">{selectedApprovedCotizacion.cliente.nombre} · {formatCurrency(selectedApprovedCotizacion.total)}</div>
										<div className="mt-1 text-xs text-slate-500">{selectedApprovedCotizacion.items.length} ítem(s) aprobados · {formatDate(selectedApprovedCotizacion.createdAt)}</div>
									</>
								) : (
									<div>Selecciona una cotización aprobada para crear un lote nuevo con sus referencias base.</div>
								)}
							</div>
						</div>

						<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
							<div className="space-y-2 xl:col-span-2">
								<Label>Cliente / contrato</Label>
								<SearchableNativeSelect
									value={clienteId}
									onChange={handleClienteChange}
									options={clienteOptions}
									searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
									selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
									searchPlaceholder="Buscar cliente..."
									emptyText={loading ? 'Cargando clientes...' : 'No hay clientes'}
									includeAllOption={{ value: '', label: 'Selecciona un cliente' }}
								/>
							</div>
							<div className="space-y-2">
								<Label>Bodega de salida</Label>
								<SearchableNativeSelect
									value={warehouseId}
									onChange={setWarehouseId}
									options={warehouseOptions}
									searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
									selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
									includeAllOption={{ value: '', label: 'Selecciona bodega' }}
								/>
							</div>
						</div>

						<div className="flex flex-wrap gap-2">
							<Button type="button" variant="outline" className="rounded-2xl px-4 text-sm" onClick={() => addRow()}>
								<Plus className="mr-2 h-4 w-4" />
								Agregar ficha
							</Button>
							<Button type="button" variant="outline" className="rounded-2xl px-4 text-sm" onClick={selectRowsForCurrentCliente}>
								Marcar lote actual
							</Button>
							{rowsBySede.map((item) => (
								<Button key={item.sedeId} type="button" variant="outline" className="rounded-2xl px-4 text-sm" onClick={() => selectRowsForSede(item.sedeId)}>
									{item.sedeName} · {item.count}
								</Button>
							))}
						</div>

						<div className="space-y-3">
							{plannerRows.map((row, index) => {
								const employee = employeeById.get(row.employeeId)
								const material = materialById.get(row.materialId)
								const delivered = row.deliveryStatus === 'REMITIDA'
								return (
									<div key={row.id} className={cn('rounded-[24px] border px-4 py-4', row.selected ? 'border-sky-200 bg-sky-50/40' : delivered ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white')}>
										<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
											<div>
												<div className="text-sm font-semibold text-slate-950">Ficha {index + 1}</div>
												<div className="text-xs text-slate-500">
													{delivered
														? `Entregada${row.remisionNumero ? ` en ${row.remisionNumero}` : ''}${row.deliveredAt ? ` · ${formatDate(row.deliveredAt)}` : ''}`
														: employee
															? `${employee.fullName} · ${employee.sede}`
															: row.employeeName
																? `${row.employeeName} · ${row.sedeName || 'Sin sede'}`
																: 'Asigna empleado y referencia para habilitar la remisión parcial.'}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<label className="flex items-center gap-2 text-xs text-slate-600">
													<input type="checkbox" checked={row.selected} disabled={delivered} onChange={(event) => updateRow(row.id, { selected: event.target.checked })} />
													Incluir en corte
												</label>
												<Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => removeRow(row.id)}>Quitar</Button>
											</div>
										</div>

										<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
											<div className="space-y-2">
												<Label>Empleado</Label>
												<SearchableNativeSelect
													value={row.employeeId}
													onChange={(value) => updateRow(row.id, { employeeId: value })}
													options={employeeOptions}
													searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
													selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
													searchPlaceholder="Buscar empleado..."
													emptyText="No hay empleados activos"
													includeAllOption={{ value: '', label: 'Selecciona empleado' }}
												/>
											</div>
											<div className="space-y-2">
												<Label>Referencia</Label>
												<SearchableNativeSelect
													value={row.materialId}
													onChange={(value) => updateRow(row.id, { materialId: value })}
													options={materialOptions}
													searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
													selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
													searchPlaceholder="Buscar referencia..."
													emptyText="No hay referencias activas"
													includeAllOption={{ value: '', label: 'Selecciona referencia' }}
												/>
											</div>
											<div className="space-y-2">
												<Label>Sede destino</Label>
												<Input value={sedeById.get(row.sedeId)?.nombre || employee?.sede || row.sedeName || ''} readOnly className="h-11 rounded-xl text-sm" placeholder="Se asigna por empleado" />
											</div>
										</div>

										<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
											<div className="space-y-2">
												<Label>Talla</Label>
												<Input value={row.talla} onChange={(event) => updateRow(row.id, { talla: event.target.value.toUpperCase() })} className="h-11 rounded-xl text-sm" placeholder="Ej: M" />
											</div>
											<div className="space-y-2">
												<Label>Color</Label>
												<Input value={row.color} onChange={(event) => updateRow(row.id, { color: event.target.value })} className="h-11 rounded-xl text-sm" placeholder={material?.color || 'Ej: Azul'} />
											</div>
											<div className="space-y-2">
												<Label>Cantidad</Label>
												<Input type="number" min="1" step="1" value={row.quantity} onChange={(event) => updateRow(row.id, { quantity: event.target.value })} className="h-11 rounded-xl text-sm" />
											</div>
											<div className="space-y-2">
												<Label>Stock visible</Label>
												<Input value={material ? `${formatNumber(material.stockActual)} ${material.unidadMedida}` : ''} readOnly className="h-11 rounded-xl text-sm" placeholder="Selecciona referencia" />
											</div>
										</div>

										<div className="mt-4 space-y-2">
											<Label>Detalle de ficha</Label>
											<Textarea value={row.note} onChange={(event) => updateRow(row.id, { note: event.target.value })} className="min-h-[80px] rounded-2xl text-sm" placeholder="Cargo, observaciones, kit, reposición o cualquier detalle operativo." />
										</div>
									</div>
								)
							})}
						</div>
					</CardContent>
				</Card>

				<div className="space-y-5">
					<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
						<CardHeader className="border-b border-slate-100 pb-5">
							<CardTitle className="text-2xl text-slate-950">Lotes guardados</CardTitle>
							<CardDescription>Filtra por cliente, sede o estado de entrega y recarga el lote que necesites continuar.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-6">
							<div className="grid gap-3">
								<SearchableNativeSelect
									value={filterClienteId}
									onChange={setFilterClienteId}
									options={clienteOptions}
									searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
									selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
									searchPlaceholder="Filtrar por cliente..."
									includeAllOption={{ value: '', label: 'Todos los clientes' }}
								/>
								<SearchableNativeSelect
									value={filterSedeId}
									onChange={setFilterSedeId}
									options={toNativeOptions((overview?.sedes ?? []).map((sede) => ({ id: sede.id, label: sede.nombre })))}
									searchClassName="h-9 rounded-xl border-slate-200 bg-white text-sm"
									selectClassName="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400"
									searchPlaceholder="Filtrar por sede..."
									includeAllOption={{ value: '', label: 'Todas las sedes' }}
								/>
								<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-400">
									<option value="">Todos los estados</option>
									<option value="BORRADOR">Borrador</option>
									<option value="EN_PREPARACION">En preparación</option>
									<option value="ENTREGA_PARCIAL">Entrega parcial</option>
									<option value="ENTREGADA">Entregada</option>
								</select>
							</div>

							<div className="space-y-3">
								{filteredPedidos.length ? filteredPedidos.map((pedido) => {
									const meta = getPedidoStatusMeta(pedido.status)
									return (
										<button key={pedido.id} type="button" onClick={() => loadPedidoIntoPlanner(pedido)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)] transition hover:border-sky-300">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div className="font-semibold text-slate-950">{pedido.title || pedido.id}</div>
												<span className={cn('rounded-full border px-2.5 py-1 text-xs font-medium', meta.className)}>{meta.label}</span>
											</div>
											<div className="mt-1 text-sm text-slate-600">{pedido.clienteNombre || 'Sin cliente'}{pedido.cotizacionNumero ? ` · ${pedido.cotizacionNumero}` : ''}</div>
											<div className="mt-2 text-xs text-slate-500">{pedido.itemCount} ficha(s) · {pedido.deliveredCount} remitida(s) · {formatDate(pedido.updatedAt)}</div>
										</button>
									)
								}) : (
									<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
										No hay lotes persistidos con esos filtros.
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
						<CardHeader className="border-b border-slate-100 pb-5">
							<CardTitle className="text-2xl text-slate-950">Corte para remisión parcial</CardTitle>
							<CardDescription>Usa las fichas marcadas para emitir una entrega parcial y dejar trazabilidad por empleado, talla, color y sede.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-6">
							<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
								{selectedRows.length} ficha(s) listas para remitir{selectedCliente ? ` · Cliente ${selectedCliente.nombre}` : selectedApprovedCotizacion ? ` · Cliente ${selectedApprovedCotizacion.cliente.nombre}` : ''}.
							</div>

							<div className="space-y-2">
								<Label>Nota general del corte</Label>
								<Textarea value={batchNote} onChange={(event) => setBatchNote(event.target.value)} className="min-h-[90px] rounded-2xl text-sm" placeholder="Ej: Entrega parcial sede norte, corte 1 de uniformes operativos." />
							</div>

							<div className="space-y-2">
								{groupedSelectedSummary.length ? groupedSelectedSummary.map((item) => (
									<div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
										<div className="font-semibold text-slate-950">{item.label}</div>
										<div className="mt-1">{item.rows} ficha(s) · {formatNumber(item.quantity)} unidad(es)</div>
									</div>
								)) : (
									<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
										Marca fichas completas para preparar la remisión parcial.
									</div>
								)}
							</div>

							<Button type="button" size="lg" className="w-full rounded-2xl px-5 text-sm" disabled={savingRemision || !selectedRows.length || !warehouseId} onClick={() => void emitPartialRemision()}>
								{savingRemision ? 'Emitiendo remisión...' : 'Emitir remisión parcial'}
							</Button>
						</CardContent>
					</Card>

					<Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
						<CardHeader className="border-b border-slate-100 pb-5">
							<CardTitle className="text-2xl text-slate-950">Remisiones recientes</CardTitle>
							<CardDescription>Últimas remisiones emitidas desde tu sede para mantener seguimiento del nicho.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3 p-6">
							{overview?.recentRemisiones.length ? overview.recentRemisiones.map((remision) => (
								<div key={remision.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm shadow-[0_14px_34px_-30px_rgba(15,23,42,0.35)]">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div className="font-semibold text-slate-950">{remision.numero}</div>
										<div className="text-xs text-slate-500">{formatDate(remision.createdAt)}</div>
									</div>
									<div className="mt-1 text-slate-600">{remision.clienteNombre || 'Sin cliente'} · {remision.warehouse?.nombre || 'Sin bodega'}</div>
									<div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
										{remision.items.slice(0, 3).map((item) => (
											<span key={item.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">{item.material.nombre} · {formatNumber(item.quantity)}</span>
										))}
									</div>
									{remision.note ? <div className="mt-2 text-xs text-slate-500">{remision.note}</div> : null}
								</div>
							)) : (
								<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
									Aún no hay remisiones recientes para esta sede.
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	)
}