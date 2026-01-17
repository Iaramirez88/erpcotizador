/**
 * Provider de NextAuth
 * 
 * Envuelve la aplicación para proporcionar el contexto de sesión
 * Debe ser un Client Component
 */

"use client"

import { SessionProvider } from "next-auth/react"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
