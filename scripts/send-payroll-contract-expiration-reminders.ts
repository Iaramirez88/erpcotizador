import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { sendPayrollContractExpirationReminders } from '../src/lib/payroll-contract-reminders'

function readArg(flag: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  return hit ? hit.slice(flag.length + 1) : undefined
}

async function main() {
  const empresaId = readArg('--empresa')
  const summary = await sendPayrollContractExpirationReminders({ empresaId })
  console.log(JSON.stringify({ ok: true, ...summary }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })