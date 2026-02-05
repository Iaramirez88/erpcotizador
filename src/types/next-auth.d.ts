/**
 * Tipos extendidos para NextAuth
 * Agregar propiedades personalizadas a User y Session
 */

import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession["user"]
  }

  interface User {
    role: string
    remember?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    remember?: boolean
    absExp?: number
    lastActive?: number
  }
}
