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
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import type { JWT } from "next-auth/jwt"
import type { Session, User } from "next-auth"

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
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validar que se envíen email y password
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email y contraseña son requeridos")
        }

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
          role: user.role,
          image: user.image
        }
      }
    })
  ],

  // Configuración de páginas personalizadas
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  // Configuración de sesión
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },

  // Callbacks para personalizar el comportamiento
  callbacks: {
    // Callback de JWT - Se ejecuta cuando se crea o actualiza el token
    async jwt({ token, user }: { token: JWT; user?: User | null }) {
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
      return token
    },

    // Callback de sesión - Se ejecuta cuando se obtiene la sesión del cliente
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        const resolvedUserId = (token.id ?? token.sub) as string | undefined
        if (resolvedUserId) {
          session.user.id = resolvedUserId
        }

        if (token.role) {
          session.user.role = token.role as string
        }
      }
      return session
    }
  },

  // Configuración de seguridad
  secret: process.env.NEXTAUTH_SECRET,
  
  // Debug en desarrollo
  debug: process.env.NODE_ENV === 'development',
}

// Exportar la función auth para Server Components
import NextAuth from "next-auth"

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
