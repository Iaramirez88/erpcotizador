import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { execSync } from 'child_process'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = execSync('npm run payroll:contract-reminders', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      output: result.slice(-500),
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    endpoint: '/api/admin/jobs/payroll-contract-reminders',
    method: 'POST',
    description: 'Dispara el recordatorio diario de contratos por vencer en nómina.',
    authentication: 'Requiere X-API-Key header o Authorization: Bearer token',
    cron_setup: `# Ejecutar todos los días a las 7:00 a.m.\n0 7 * * * curl -X POST https://sgdigitalordex.com/api/admin/jobs/payroll-contract-reminders -H "X-API-Key: YOUR_KEY"`,
  })
}