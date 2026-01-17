/**
 * API Route: Clientes
 * GET /api/clientes - Lista todos los clientes
 * POST /api/clientes - Crea un nuevo cliente
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

// GET - Listar todos los clientes
export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'READ')
    if (!access.ok) return access.response

    // Obtener parámetros de búsqueda (opcional)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    // Construir query
    const where = search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' as const } },
            { documento: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Obtener clientes de la base de datos
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            cotizaciones: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: clientes
    })

  } catch (error) {
    console.error("Error al obtener clientes:", error)
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo cliente
export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    // Obtener datos del body
    const body = await request.json()
    const {
      nombre,
      tipoDocumento,
      documento,
      email,
      telefono,
      celular,
      direccion,
      ciudad,
      departamento
    } = body

    // Validar campos requeridos
    if (!nombre || !tipoDocumento || !documento) {
      return NextResponse.json(
        { error: "Nombre, tipo de documento y documento son requeridos" },
        { status: 400 }
      )
    }

    // Verificar si el documento ya existe
    const existingCliente = await prisma.cliente.findUnique({
      where: { documento }
    })

    if (existingCliente) {
      return NextResponse.json(
        { error: "Ya existe un cliente con este documento" },
        { status: 400 }
      )
    }

    // Obtener o crear empresa por defecto
    let empresa = await prisma.empresa.findFirst()
    
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: "SGDigital",
          nit: "900000000-1"
        }
      })
    }
    
    const empresaId = empresa.id

    // Crear cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        tipoDocumento,
        documento,
        email,
        telefono,
        celular,
        direccion,
        ciudad,
        departamento,
        empresaId
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Cliente creado exitosamente",
        data: cliente
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Error al crear cliente:", error)
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    )
  }
}
