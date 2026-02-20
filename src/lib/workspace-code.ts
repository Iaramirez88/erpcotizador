import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomPart(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  return out
}

export function generateWorkspaceCode(): string {
  return `WS-${randomPart(8)}`
}

export async function ensureWorkspaceCodeForEmpresa(empresaId: string): Promise<string> {
  const existing = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, workspaceCode: true } })
  if (!existing?.id) throw new Error('EMPRESA_NOT_FOUND')
  if (existing.workspaceCode) return existing.workspaceCode

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = generateWorkspaceCode()
    try {
      const updated = await prisma.empresa.update({
        where: { id: empresaId },
        data: { workspaceCode: code },
        select: { workspaceCode: true },
      })
      if (updated.workspaceCode) return updated.workspaceCode
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue
      }
      throw error
    }
  }

  throw new Error('WORKSPACE_CODE_GENERATION_FAILED')
}
