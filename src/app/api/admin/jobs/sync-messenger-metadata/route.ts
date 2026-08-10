import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { execSync } from 'child_process'

/**
 * POST /api/admin/jobs/sync-messenger-metadata
 * 
 * Ejecuta sincronización de nombres y mensajes de Messenger/Facebook
 * Requiere: autenticación de admin + API key
 * 
 * Llamable por:
 * - cron del servidor: curl -X POST https://sgdigitalordex.com/api/admin/jobs/sync-messenger-metadata -H "Authorization: Bearer YOUR_SECRET_KEY"
 * - Manualmente desde el CRM (admin panel)
 * - Scheduled tasks
 */

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Verifica API key del header
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info('🚀 Iniciando sync de metadata de Messenger via API...')

    // Ejecuta el script con tsx
    const result = execSync('npm run sync:messenger-metadata', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    logger.info('✅ Sync completado')

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      output: result.slice(-500), // Últimas 500 chars del output
    })
  } catch (error) {
    logger.error('❌ Error en sync API:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    )
  }

  // GET devuelve instrucciones para usar el endpoint
  return NextResponse.json({
    endpoint: '/api/admin/jobs/sync-messenger-metadata',
    method: 'POST',
    description: 'Sincroniza nombres y mensajes de Messenger/Facebook',
    authentication: 'Requiere X-API-Key header o Authorization: Bearer token',
    curl_example: `curl -X POST https://sgdigitalordex.com/api/admin/jobs/sync-messenger-metadata \\
  -H "X-API-Key: ${process.env.ADMIN_API_KEY?.slice(0, 10)}..."`,
    cron_setup: `# Ejecutar cada hora en servidor Linux
0 * * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/sync-messenger-metadata -H "X-API-Key: YOUR_KEY"

# O cada 30 minutos
*/30 * * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/sync-messenger-metadata -H "X-API-Key: YOUR_KEY"`,
  })
}
