import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DropdownSeedItem = {
  value: string
  label: string
  sortOrder: number
  meta?: Prisma.InputJsonValue
}

type DropdownSeed = {
  key: string
  nombre: string
  descripcion: string
  items: DropdownSeedItem[]
}

const ODONTOLOGY_DROPDOWNS: DropdownSeed[] = [
  {
    key: 'odontologia_motivo_consulta',
    nombre: 'Odontología · Motivo de consulta',
    descripcion: 'Motivos de consulta usados en historia clínica y agenda inicial.',
    items: [
      { value: 'CONTROL', label: 'Control general', sortOrder: 10 },
      { value: 'DOLOR', label: 'Dolor dental', sortOrder: 20 },
      { value: 'VALORACION', label: 'Valoración inicial', sortOrder: 30 },
      { value: 'URGENCIA', label: 'Urgencia', sortOrder: 40 },
      { value: 'ESTETICA', label: 'Estética dental', sortOrder: 50 },
    ],
  },
  {
    key: 'odontologia_estado_tratamiento',
    nombre: 'Odontología · Estado del tratamiento',
    descripcion: 'Estados rápidos para evolución clínica y seguimiento del paciente.',
    items: [
      { value: 'VALORACION', label: 'En valoración', sortOrder: 10 },
      { value: 'EN_CURSO', label: 'En tratamiento', sortOrder: 20 },
      { value: 'PAUSADO', label: 'Pausado', sortOrder: 30 },
      { value: 'FINALIZADO', label: 'Finalizado', sortOrder: 40 },
      { value: 'REMISION', label: 'Remisión externa', sortOrder: 50 },
    ],
  },
  {
    key: 'odontologia_tipo_procedimiento',
    nombre: 'Odontología · Tipo de procedimiento',
    descripcion: 'Procedimientos frecuentes para registro clínico inicial.',
    items: [
      { value: 'LIMPIEZA', label: 'Limpieza', sortOrder: 10, meta: { suggestedCostCOP: 90000, scope: 'preventivo' } },
      { value: 'RESINA', label: 'Resina', sortOrder: 20, meta: { suggestedCostCOP: 180000, scope: 'restaurativo' } },
      { value: 'ENDODONCIA', label: 'Endodoncia', sortOrder: 30, meta: { suggestedCostCOP: 650000, scope: 'especializado' } },
      { value: 'EXODONCIA', label: 'Exodoncia', sortOrder: 40, meta: { suggestedCostCOP: 220000, scope: 'quirurgico' } },
      { value: 'ORTODONCIA', label: 'Ortodoncia', sortOrder: 50, meta: { suggestedCostCOP: 350000, scope: 'control' } },
    ],
  },
  {
    key: 'odontologia_estado_cita',
    nombre: 'Odontología · Estado de cita',
    descripcion: 'Estados operativos para la agenda clínica.',
    items: [
      { value: 'SCHEDULED', label: 'Agendada', sortOrder: 10 },
      { value: 'CONFIRMED', label: 'Confirmada', sortOrder: 20 },
      { value: 'IN_PROGRESS', label: 'En atención', sortOrder: 30 },
      { value: 'COMPLETED', label: 'Atendida', sortOrder: 40 },
      { value: 'CANCELLED', label: 'Cancelada', sortOrder: 50 },
      { value: 'NO_SHOW', label: 'No asistió', sortOrder: 60 },
    ],
  },
  {
    key: 'odontologia_condicion_dental',
    nombre: 'Odontología · Condición dental',
    descripcion: 'Hallazgos estructurados para odontograma visual.',
    items: [
      { value: 'SANO', label: 'Sano', sortOrder: 10 },
      { value: 'CARIES', label: 'Caries', sortOrder: 20 },
      { value: 'FRACTURA', label: 'Fractura', sortOrder: 30 },
      { value: 'ENDODONCIA_PREVIA', label: 'Endodoncia previa', sortOrder: 40 },
      { value: 'AUSENTE', label: 'Ausente', sortOrder: 50 },
      { value: 'MOVILIDAD', label: 'Movilidad', sortOrder: 60 },
      { value: 'RESTAURACION', label: 'Restauración', sortOrder: 70 },
    ],
  },
]

async function upsertDropdown(empresaId: string, seed: DropdownSeed) {
  const dropdown = await prisma.configDropdown.upsert({
    where: { empresaId_key: { empresaId, key: seed.key } },
    create: {
      empresaId,
      key: seed.key,
      nombre: seed.nombre,
      descripcion: seed.descripcion,
    },
    update: {
      nombre: seed.nombre,
      descripcion: seed.descripcion,
    },
    select: { id: true },
  })

  for (const item of seed.items) {
    const meta = (item.meta ?? {}) as Prisma.InputJsonValue

    await prisma.configDropdownItem.upsert({
      where: { dropdownId_value: { dropdownId: dropdown.id, value: item.value } },
      create: {
        dropdownId: dropdown.id,
        value: item.value,
        label: item.label,
        sortOrder: item.sortOrder,
        meta,
        activo: true,
      },
      update: {
        label: item.label,
        sortOrder: item.sortOrder,
        meta,
        activo: true,
      },
    })
  }
}

export async function ensureOdontologySeedsForEmpresa(empresaId: string) {
  for (const seed of ODONTOLOGY_DROPDOWNS) {
    await upsertDropdown(empresaId, seed)
  }
}

export async function ensureBusinessTypeSeedsForEmpresa(args: { empresaId: string; businessType: string | null | undefined }) {
  switch (args.businessType) {
    case 'ODONTOLOGIA':
      await ensureOdontologySeedsForEmpresa(args.empresaId)
      break
    default:
      break
  }
}

export function getOdontologyDropdownKeys() {
  return ODONTOLOGY_DROPDOWNS.map((item) => item.key)
}