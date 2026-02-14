import { UserRole } from '@prisma/client'

const DEFAULT_SUPER_ADMIN_EMAIL = 'ivanimage@hotmail.com'

export function getSuperAdminEmail(): string {
  return String(process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN_EMAIL)
    .trim()
    .toLowerCase()
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === getSuperAdminEmail()
}

export function coerceEffectiveUserRole(args: {
  email?: string | null
  role?: UserRole | string | null
}): UserRole {
  const role = (args.role ?? 'USER') as UserRole
  if (role === 'ADMIN' && !isSuperAdminEmail(args.email)) return 'USER'
  return role
}
