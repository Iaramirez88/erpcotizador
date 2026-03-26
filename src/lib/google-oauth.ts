import crypto from 'node:crypto'
import { UserRole } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { coerceEffectiveUserRole } from '@/lib/super-admin'
import { requireEmpresaIdForUser } from '@/lib/rbac'

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  id_token?: string
}

type GoogleUserInfo = {
  id?: string
  name?: string
  email?: string
  picture?: string
}

type JwtPayload = {
  sub: string
  email: string
  name?: string | null
  picture?: string | null
  role: UserRole
  empresaId?: string | null
  iat: number
  exp: number
}

function base64UrlEncode(input: Buffer | string) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input)
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function signJwtSegment(secret: string, value: string) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(value).digest())
}

function requireGoogleOAuthEnv() {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim()
  const redirectUri = String(process.env.GOOGLE_REDIRECT_URI || '').trim()
  const jwtSecret = String(process.env.NEXTAUTH_SECRET || '').trim()

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Faltan GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REDIRECT_URI.')
  }

  if (!jwtSecret) {
    throw new Error('Falta NEXTAUTH_SECRET para firmar el token del callback de Google.')
  }

  return { clientId, clientSecret, redirectUri, jwtSecret }
}

function buildFrontendRedirect(params: { token?: string; error?: string }) {
  const url = new URL('https://sgdigitalordex.com/dashboard')
  if (params.token) url.searchParams.set('token', params.token)
  if (params.error) url.searchParams.set('error', params.error)
  return url
}

async function exchangeGoogleCode(code: string) {
  const { clientId, clientSecret, redirectUri } = requireGoogleOAuthEnv()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })

  const json = (await response.json().catch(() => ({}))) as GoogleTokenResponse & { error?: string; error_description?: string }
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'No se pudo intercambiar el code por tokens de Google.')
  }

  return json
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  const json = (await response.json().catch(() => ({}))) as GoogleUserInfo & { error?: { message?: string } }
  if (!response.ok) {
    throw new Error(json.error?.message || 'No se pudo obtener el perfil del usuario desde Google.')
  }

  if (!json.email) {
    throw new Error('Google no devolvió un email válido para este usuario.')
  }

  return {
    providerAccountId: String(json.id || json.email).trim(),
    name: String(json.name || '').trim() || null,
    email: String(json.email || '').trim().toLowerCase(),
    picture: String(json.picture || '').trim() || null,
  }
}

async function upsertGoogleCrmUser(args: {
  profile: Awaited<ReturnType<typeof fetchGoogleUserInfo>>
  token: Awaited<ReturnType<typeof exchangeGoogleCode>>
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: args.profile.email },
    select: {
      id: true,
      email: true,
      role: true,
      empresaId: true,
    },
  })

  const role = coerceEffectiveUserRole({
    email: args.profile.email,
    role: existingUser?.role || 'USER',
  })

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: args.profile.name,
          image: args.profile.picture,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          empresaId: true,
        },
      })
    : await prisma.user.create({
        data: {
          email: args.profile.email,
          name: args.profile.name,
          image: args.profile.picture,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          empresaId: true,
        },
      })

  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'google',
        providerAccountId: args.profile.providerAccountId,
      },
    },
    update: {
      userId: user.id,
      type: 'oauth',
      access_token: args.token.access_token || null,
      refresh_token: args.token.refresh_token || undefined,
      expires_at: typeof args.token.expires_in === 'number' ? Math.floor(Date.now() / 1000) + args.token.expires_in : null,
      token_type: args.token.token_type || null,
      scope: args.token.scope || null,
      id_token: args.token.id_token || null,
    },
    create: {
      userId: user.id,
      type: 'oauth',
      provider: 'google',
      providerAccountId: args.profile.providerAccountId,
      access_token: args.token.access_token || null,
      refresh_token: args.token.refresh_token || null,
      expires_at: typeof args.token.expires_in === 'number' ? Math.floor(Date.now() / 1000) + args.token.expires_in : null,
      token_type: args.token.token_type || null,
      scope: args.token.scope || null,
      id_token: args.token.id_token || null,
    },
  })

  const empresaId = await requireEmpresaIdForUser(user.id)

  return {
    ...user,
    empresaId,
  }
}

function createSignedCallbackJwt(user: {
  id: string
  email: string
  name?: string | null
  image?: string | null
  role: UserRole
  empresaId?: string | null
}) {
  const { jwtSecret } = requireGoogleOAuthEnv()
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  }
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name || null,
    picture: user.image || null,
    role: user.role,
    empresaId: user.empresaId || null,
    iat: now,
    exp: now + (60 * 60),
  }

  const headerEncoded = base64UrlEncode(JSON.stringify(header))
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload))
  const signature = signJwtSegment(jwtSecret, `${headerEncoded}.${payloadEncoded}`)
  return `${headerEncoded}.${payloadEncoded}.${signature}`
}

export async function handleGoogleOAuthCallback(request: Request) {
  const url = new URL(request.url)
  const code = String(url.searchParams.get('code') || '').trim()
  const oauthError = String(url.searchParams.get('error') || '').trim()

  if (oauthError) {
    console.error('[Google OAuth] Google devolvió error en el callback.', { oauthError })
    return NextResponse.redirect(buildFrontendRedirect({ error: oauthError }))
  }

  if (!code) {
    console.error('[Google OAuth] Callback recibido sin code.')
    return NextResponse.json({ error: 'Falta el parámetro code en el callback de Google.' }, { status: 400 })
  }

  try {
    console.info('[Google OAuth] Intercambiando code por tokens.')
    const token = await exchangeGoogleCode(code)

    console.info('[Google OAuth] Consultando userinfo de Google.')
    const profile = await fetchGoogleUserInfo(String(token.access_token))

    console.info('[Google OAuth] Sincronizando usuario CRM.', { email: profile.email })
    const user = await upsertGoogleCrmUser({ profile, token })

    const signedToken = createSignedCallbackJwt(user)
    console.info('[Google OAuth] Usuario autenticado correctamente.', { userId: user.id, email: user.email })

    return NextResponse.redirect(buildFrontendRedirect({ token: signedToken }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar la autenticación con Google.'
    console.error('[Google OAuth] Error completando el callback.', { error: message })
    return NextResponse.redirect(buildFrontendRedirect({ error: message }))
  }
}