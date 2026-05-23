import { NextResponse } from 'next/server'
import { ModuleKey, RestauranteTurnoStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { computeRestaurantBoardSummary, createEmptyRestaurantBoard, sanitizeRestaurantBoard } from '@/lib/restaurante'

export const runtime = 'nodejs'

type PostBody = {
  id?: string | null
  action?: 'SAVE' | 'CLOSE' | null
  board?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function buildTurnoTitle(now: Date) {
  const formattedDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(now)
  return `Turno ${formattedDate}`
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as PostBody | null
    const turnoId = cleanText(body?.id)
    const action = body?.action === 'CLOSE' ? 'CLOSE' : 'SAVE'
    const board = sanitizeRestaurantBoard(body?.board)
    const summary = computeRestaurantBoardSummary(board)
    const now = new Date()

    const payload = await prisma.$transaction(async (tx) => {
      const existing = turnoId
        ? await tx.restauranteTurno.findFirst({
            where: { id: turnoId, empresaId: access.empresaId, sedeId: access.sedeId },
            select: { id: true, status: true },
          })
        : await tx.restauranteTurno.findFirst({
            where: { empresaId: access.empresaId, sedeId: access.sedeId, status: RestauranteTurnoStatus.ABIERTO },
            orderBy: [{ updatedAt: 'desc' }],
            select: { id: true, status: true },
          })

      if (turnoId && !existing) {
        throw new Error('TURNO_NOT_FOUND')
      }

      if (existing) {
        const updated = await tx.restauranteTurno.update({
          where: { id: existing.id },
          data: {
            boardData: board,
            summaryData: summary,
            closingNotes: board.closingNotes || null,
            status: action === 'CLOSE' ? RestauranteTurnoStatus.CERRADO : RestauranteTurnoStatus.ABIERTO,
            closedAt: action === 'CLOSE' ? now : null,
            closedById: action === 'CLOSE' ? access.userId : null,
            updatedById: access.userId,
          },
          select: {
            id: true,
            title: true,
            status: true,
            boardData: true,
            summaryData: true,
            closingNotes: true,
            openedAt: true,
            closedAt: true,
            updatedAt: true,
          },
        })
        return updated
      }

      if (action === 'CLOSE' && JSON.stringify(board) === JSON.stringify(createEmptyRestaurantBoard())) {
        throw new Error('EMPTY_TURNO')
      }

      return tx.restauranteTurno.create({
        data: {
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          title: buildTurnoTitle(now),
          status: action === 'CLOSE' ? RestauranteTurnoStatus.CERRADO : RestauranteTurnoStatus.ABIERTO,
          boardData: board,
          summaryData: summary,
          closingNotes: board.closingNotes || null,
          openedAt: now,
          closedAt: action === 'CLOSE' ? now : null,
          createdById: access.userId,
          updatedById: access.userId,
          closedById: action === 'CLOSE' ? access.userId : null,
        },
        select: {
          id: true,
          title: true,
          status: true,
          boardData: true,
          summaryData: true,
          closingNotes: true,
          openedAt: true,
          closedAt: true,
          updatedAt: true,
        },
      })
    })

    const normalizedBoard = sanitizeRestaurantBoard(payload.boardData)

    return NextResponse.json({
      ok: true,
      data: {
        id: payload.id,
        title: payload.title,
        status: payload.status,
        closingNotes: payload.closingNotes,
        openedAt: payload.openedAt,
        closedAt: payload.closedAt,
        updatedAt: payload.updatedAt,
        board: normalizedBoard,
        summary: computeRestaurantBoardSummary(normalizedBoard),
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'TURNO_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'El turno ya no existe o no pertenece a tu sede' }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'EMPTY_TURNO') {
      return NextResponse.json({ ok: false, error: 'No hay datos del turno para cerrar' }, { status: 400 })
    }
    console.error('POST /api/restaurante/turnos error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo guardar el turno de restaurante' }, { status: 500 })
  }
}