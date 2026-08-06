import { redirect } from 'next/navigation'

export default function LegacyNominaHomePage() {
  redirect('/dashboard/nomina')
}