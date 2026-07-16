'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ImpersonatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = (searchParams?.get('token') ?? '').trim()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('El acceso temporal no es válido o ya no está disponible.')
      return
    }

    let cancelled = false

    async function startImpersonation() {
      const result = await signIn('credentials', {
        impersonationToken: token,
        redirect: false,
      })

      if (cancelled) return

      if (result?.error) {
        setStatus('error')
        setError('No se pudo iniciar la sesión temporal del usuario. El código puede haber expirado o ya fue usado.')
        return
      }

      router.replace('/dashboard')
      router.refresh()
    }

    void startImpersonation()

    return () => {
      cancelled = true
    }
  }, [router, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Acceso temporal</CardTitle>
          <CardDescription>
            {status === 'loading'
              ? 'Estamos iniciando la sesión temporal del usuario seleccionado.'
              : 'No fue posible completar el acceso temporal.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' ? (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              Validando código temporal y creando sesión...
            </div>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          {status === 'error' ? (
            <Button asChild variant="outline">
              <Link href="/auth/login">Volver al login</Link>
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  )
}