/**
 * Página Principal
 * Redirige al dashboard o al login según el estado de autenticación
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()
  
  if (session) {
    redirect("/dashboard")
  } else {
    redirect("/auth/login")
  }
}
