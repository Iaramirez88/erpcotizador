/**
 * Retención de cuentas: avisos por correo y borrado automático.
 *
 * Reglas (ver `src/lib/retention-policy.ts`):
 *  - Licencia pagada vencida → correo de suspensión + fecha de eliminación.
 *  - Trial de 7 días hábiles terminado → correo de prueba terminada.
 *  - 7 días antes del borrado → último aviso.
 *  - 60 días sin acceso → se elimina la cuenta (y el espacio personal o de único usuario).
 *
 * Uso:
 *   npx tsx scripts/account-retention.ts             # ejecuta avisos y borrado real
 *   npx tsx scripts/account-retention.ts --dry-run   # solo simula (no envía ni borra)
 *   npx tsx scripts/account-retention.ts --no-purge  # envía avisos sin eliminar cuentas
 *
 * Programar una vez al día (por ejemplo con el programador de tareas del servidor o un cron
 * externo que llame a `POST /api/cron/account-retention?dryRun=0` con `CRON_SECRET`).
 */

import 'dotenv/config'
import { runAccountRetention } from '../src/lib/account-retention'
import { prisma } from '../src/lib/prisma'

async function main() {
  const flags = new Set(process.argv.slice(2))
  const dryRun = flags.has('--dry-run') || flags.has('--dryRun')
  const purge = !flags.has('--no-purge')

  const summary = await runAccountRetention({ dryRun, purge })
  console.log(JSON.stringify(summary, null, 2))

  if (summary.errors.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
