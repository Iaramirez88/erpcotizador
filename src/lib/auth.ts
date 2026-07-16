/**
 * Configuración de NextAuth.js
 * 
 * Este archivo configura toda la autenticación del sistema:
 * - Login con email y contraseña
 * - Sesiones
 * - Callbacks personalizados
 * - Integración con Prisma
 */

import type { NextAuthConfig } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import type { JWT } from "next-auth/jwt"
import type { Session, User } from "next-auth"
import { coerceEffectiveUserRole } from "@/lib/super-admin"
import { requireEmpresaIdForUser } from "@/lib/rbac"
import { consumeImpersonationToken } from "@/lib/impersonation-token"

const ONE_HOUR = 60 * 60
const ONE_DAY = 24 * ONE_HOUR

const INACTIVITY_DEFAULT = 8 * ONE_HOUR
const ABSOLUTE_DEFAULT = 7 * ONE_DAY

const INACTIVITY_REMEMBER = 30 * ONE_DAY
const ABSOLUTE_REMEMBER = 30 * ONE_DAY

const LAST_ACTIVE_REFRESH = 15 * 60 // 15 min

function sanitizeJwtToken(token: JWT) {
  // Mantener solo campos mínimos para evitar que el cookie crezca
  // (Cloudflare/proxies suelen fallar cuando hay muchos Set-Cookie > ~32KB)
  const allowed = new Set([
    // estándar
    "sub",
    "iat",
    "exp",
    "jti",
    "name",
    "email",
    // custom app
    "id",
    "role",
    "remember",
    "absExp",
    "lastActive",
    "isImpersonating",
    "impersonatedByUserId",
    "impersonatedByEmail",
    "impersonatedByName",
  ])

  for (const key of Object.keys(token)) {
    if (!allowed.has(key)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (token as Record<string, unknown>)[key]
    }
  }

  // Última línea de defensa: si algún string permitido crece demasiado, lo removemos.
  // Esto previene cookies enormes por valores inesperados (p.ej. avatar base64).
  for (const key of Object.keys(token)) {
    const value = (token as Record<string, unknown>)[key]
    if (typeof value === "string" && value.length > 1024) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (token as Record<string, unknown>)[key]
    }
  }

  return token
}

export const authOptions: NextAuthConfig = {
  // Adapter de Prisma para guardar sesiones en la BD
  // @ts-expect-error - PrismaAdapter es compatible pero los tipos difieren
  adapter: PrismaAdapter(prisma),
  
  // Providers de autenticación
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember", type: "text" },
        impersonationToken: { label: "Impersonation Token", type: "text" },
      },
      async authorize(credentials) {
        const impersonationToken = typeof (credentials as Record<string, unknown> | undefined)?.impersonationToken === 'string'
          ? String((credentials as Record<string, unknown>).impersonationToken).trim()
          : ''

        if (impersonationToken) {
          const user = await consumeImpersonationToken(impersonationToken)
          if (!user) {
            throw new Error('IMPERSONATION_TOKEN_INVALID')
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: coerceEffectiveUserRole({ email: user.email, role: user.role }),
            image: user.image,
            remember: false,
            isImpersonating: true,
            impersonatedByUserId: user.impersonatedByUserId,
            impersonatedByEmail: user.impersonatedByEmail ?? undefined,
            impersonatedByName: user.impersonatedByName ?? undefined,
          }
        }

        // Validar que se envíen email y password
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos")
        }

        const remember = String((credentials as Record<string, unknown>)?.remember ?? '').toLowerCase() === 'true'

        // Buscar usuario en la base de datos
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string
          }
        })

        // Validar que el usuario exista
        if (!user || !user.password) {
          throw new Error("Usuario no encontrado")
        }

        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED")
        }

        // Validar contraseña
        const isCorrectPassword = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isCorrectPassword) {
          throw new Error("Contraseña incorrecta")
        }

        // Retornar usuario sin la contraseña
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: coerceEffectiveUserRole({ email: user.email, role: user.role }),
          image: user.image,
          remember,
        }
      }
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],

  // Configuración de páginas personalizadas
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  // Configuración de sesión
  session: {
    strategy: "jwt",
    // Cookie amplia; la expiración real se aplica vía callbacks.jwt
    maxAge: 30 * 24 * 60 * 60, // 30 días
    updateAge: LAST_ACTIVE_REFRESH,
  },

  // Callbacks para personalizar el comportamiento
  callbacks: {
    // Callback de JWT - Se ejecuta cuando se crea o actualiza el token
    async jwt({ token, user }: { token: JWT; user?: User | null }) {
      const now = Math.floor(Date.now() / 1000)

      if (user?.id) {
        token.id = user.id
      }

      // Fallback: Auth.js suele poblar `sub` con el id del usuario
      if (!token.id && token.sub) {
        token.id = token.sub
      }

      if (user && typeof (user as User).role === "string") {
        token.role = (user as User).role
      }

      // En sign-in: inicializar política de expiración (absoluta + inactividad)
      if (user) {
        if (typeof user.name === 'string') token.name = user.name
        if (typeof user.email === 'string') token.email = user.email
        // No guardar imagen/avatar en JWT cookie (puede ser muy grande).
        // El callback `session` ya refresca `session.user.image` desde BD.
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (token as Record<string, unknown>).picture

        const remember = Boolean((user as unknown as { remember?: boolean }).remember)
        token.remember = remember
        token.absExp = now + (remember ? ABSOLUTE_REMEMBER : ABSOLUTE_DEFAULT)
        token.lastActive = now
        token.isImpersonating = Boolean((user as User).isImpersonating)
        token.impersonatedByUserId = typeof (user as User).impersonatedByUserId === 'string' ? (user as User).impersonatedByUserId : undefined
        token.impersonatedByEmail = typeof (user as User).impersonatedByEmail === 'string' ? (user as User).impersonatedByEmail : undefined
        token.impersonatedByName = typeof (user as User).impersonatedByName === 'string' ? (user as User).impersonatedByName : undefined
        return sanitizeJwtToken(token)
      }

      // En requests posteriores: validar expiración absoluta
      if (typeof token.absExp === 'number' && now > token.absExp) {
        return null
      }

      // Validar inactividad
      const inactivity = token.remember ? INACTIVITY_REMEMBER : INACTIVITY_DEFAULT
      if (typeof token.lastActive === 'number' && now - token.lastActive > inactivity) {
        return null
      }

      // Sliding session: refrescar lastActive (evitar re-firmar en cada request)
      if (typeof token.lastActive === 'number' && now - token.lastActive >= LAST_ACTIVE_REFRESH) {
        token.lastActive = now
      }
      return sanitizeJwtToken(token)
    },

    // Callback de sesión - Se ejecuta cuando se obtiene la sesión del cliente
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        const resolvedUserId = (token.id ?? token.sub) as string | undefined
        if (resolvedUserId) {
          session.user.id = resolvedUserId
        }

        if (token.role) session.user.role = token.role as string
        if (typeof token.name === 'string') session.user.name = token.name
        if (typeof token.email === 'string') session.user.email = token.email
        session.user.isImpersonating = Boolean(token.isImpersonating)
        session.user.impersonatedByUserId = typeof token.impersonatedByUserId === 'string' ? token.impersonatedByUserId : undefined
        session.user.impersonatedByEmail = typeof token.impersonatedByEmail === 'string' ? token.impersonatedByEmail : undefined
        session.user.impersonatedByName = typeof token.impersonatedByName === 'string' ? token.impersonatedByName : undefined
        // No usar `token.picture` para evitar inflar el cookie; se refresca desde BD.

        // Mantener datos frescos (avatar/nombre) si cambian en BD.
        if (resolvedUserId) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: resolvedUserId },
              select: { name: true, email: true, image: true, role: true },
            })
            if (dbUser) {
              session.user.name = dbUser.name
              session.user.email = dbUser.email
              session.user.image = dbUser.image
              session.user.role = coerceEffectiveUserRole({ email: dbUser.email, role: dbUser.role })
            }
          } catch {
            // no-op
          }
        }
      }
      return session
    }
  },

  events: {
    async signIn({ user, account }) {
      const userId = user?.id
      if (!userId) return
      try {
        const isGoogleSignIn = account?.provider === 'google'
        const data: { lastLoginAt: Date; emailVerified?: Date; role?: 'ADMIN' | 'USER' } = {
          lastLoginAt: new Date(),
        }

        if (isGoogleSignIn) {
          data.emailVerified = new Date()
          if (user.email && coerceEffectiveUserRole({ email: user.email, role: 'USER' }) === 'ADMIN') {
            data.role = 'ADMIN'
          }
        }

        await prisma.user.update({ where: { id: userId }, data })
        await requireEmpresaIdForUser(userId)
      } catch {
        // no-op
      }
    },
  },

  // Configuración de seguridad
  secret: process.env.NEXTAUTH_SECRET,
  
  // Debug en desarrollo (o forzado por env en producción)
  debug:
    process.env.NODE_ENV === "development" ||
    String(process.env.AUTH_DEBUG ?? "").toLowerCase() === "true" ||
    String(process.env.NEXTAUTH_DEBUG ?? "").toLowerCase() === "true",
}

// Exportar la función auth para Server Components
import NextAuth from "next-auth"

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
