"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter()

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [debugCode, setDebugCode] = useState<string | null>(null)

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo verificar")
      }

      setMessage("Cuenta verificada. Ya puedes iniciar sesión.")
      setTimeout(() => {
        router.push("/auth/login")
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error")
    } finally {
      setIsLoading(false)
    }
  }

  const onResend = async () => {
    setIsResending(true)
    setError("")
    setMessage("")
    setDebugCode(null)

    try {
      const res = await fetch("/api/auth/verify/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reenviar")
      }

      if (typeof data?.debugCode === "string") {
        setDebugCode(data.debugCode)
      }

      setMessage(typeof data?.message === "string" ? data.message : "Código reenviado.")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Verificar cuenta</CardTitle>
          <CardDescription className="text-center">
            Ingresa el código que enviamos a tu correo
          </CardDescription>
        </CardHeader>

        <form onSubmit={onVerify}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md text-sm">
                {message}
              </div>
            )}
            {debugCode && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm">
                <div className="font-semibold">Código (modo dev)</div>
                <div className="font-mono tracking-widest text-lg">{debugCode}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading || isResending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={isLoading}
              />
              <div className="text-xs text-muted-foreground">
                Si no lo ves, revisa spam o reenvía el código.
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verificando..." : "Verificar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onResend}
              disabled={isResending || !email}
            >
              {isResending ? "Reenviando..." : "Reenviar código"}
            </Button>
            <div className="text-sm text-center text-gray-600">
              <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
                Volver al login
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
