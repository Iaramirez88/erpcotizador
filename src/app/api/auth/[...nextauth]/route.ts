/**
 * API Route de NextAuth
 * 
 * Esta ruta maneja todas las peticiones de autenticación:
 * - POST /api/auth/signin
 * - POST /api/auth/signout
 * - GET /api/auth/session
 * etc.
 */

import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
