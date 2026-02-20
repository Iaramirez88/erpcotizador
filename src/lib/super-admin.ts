import { UserRole } from '@prisma/client'

const DEFAULT_SUPER_ADMIN_EMAIL = 'ivanimage@hotmail.com'

function splitEmails(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s.includes('@'))
}

export function getSuperAdminEmails(): string[] {
  const fromList = typeof process.env.SUPER_ADMIN_EMAILS === 'string' ? process.env.SUPER_ADMIN_EMAILS : ''
  const emails = splitEmails(fromList)
  const single = getSuperAdminEmail()
  if (single && !emails.includes(single)) emails.push(single)
  return emails
}

export function getSuperAdminEmail(): string {
  return String(process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return getSuperAdminEmails().includes(normalized)
}

export function coerceEffectiveUserRole(args: {
  email?: string | null
  role?: UserRole | string | null
}): UserRole {
  const role = (args.role ?? 'USER') as UserRole
  if (isSuperAdminEmail(args.email)) return 'ADMIN'
  if (role === 'ADMIN') return 'USER'
  return role
}
