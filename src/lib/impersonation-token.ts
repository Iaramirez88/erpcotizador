import { prisma } from '@/lib/prisma'
import { randomToken, sha256Hex } from '@/lib/auth-tokens'

const IMPERSONATION_IDENTIFIER_PREFIX = 'super-admin-impersonation'
const IMPERSONATION_TTL_MS = 10 * 60 * 1000

type ImpersonationUser = {
  id: string
  email: string
  name: string | null
  role: string
  image: string | null
  emailVerified: Date | null
}

function buildIdentifier(issuedByUserId: string, targetUserId: string) {
  return `${IMPERSONATION_IDENTIFIER_PREFIX}:${issuedByUserId}:${targetUserId}`
}

export async function createImpersonationToken(args: {
  issuedByUserId: string
  targetUserId: string
}) {
  const rawToken = randomToken(32)
  const tokenHash = sha256Hex(rawToken)
  const expiresAt = new Date(Date.now() + IMPERSONATION_TTL_MS)

  await prisma.verificationToken.create({
    data: {
      identifier: buildIdentifier(args.issuedByUserId, args.targetUserId),
      token: tokenHash,
      expires: expiresAt,
    },
  })

  return {
    token: rawToken,
    expiresAt,
  }
}

export async function consumeImpersonationToken(rawToken: string): Promise<ImpersonationUser | null> {
  const normalizedToken = rawToken.trim()
  if (!normalizedToken) return null

  const tokenHash = sha256Hex(normalizedToken)
  const now = new Date()

  const record = await prisma.verificationToken.findUnique({
    where: { token: tokenHash },
    select: { identifier: true, expires: true, token: true },
  })

  if (!record) return null

  await prisma.verificationToken.delete({ where: { token: tokenHash } }).catch(() => null)

  if (record.expires <= now) return null
  if (!record.identifier.startsWith(`${IMPERSONATION_IDENTIFIER_PREFIX}:`)) return null

  const [, , targetUserId] = record.identifier.split(':')
  if (!targetUserId) return null

  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      image: true,
      emailVerified: true,
    },
  })

  if (!user?.id) return null
  if (!user.emailVerified) {
    throw new Error('EMAIL_NOT_VERIFIED')
  }

  return user
}