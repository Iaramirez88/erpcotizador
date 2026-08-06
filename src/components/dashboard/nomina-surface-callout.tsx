'use client'

import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

type NominaSurfaceCalloutProps = {
  adminTitle: string
  adminDescription: string
  employeeTitle: string
  employeeDescription: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
}

export function NominaSurfaceCallout({
  adminTitle,
  adminDescription,
  employeeTitle,
  employeeDescription,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: NominaSurfaceCalloutProps) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_48%,#f7fff9_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.32)]">
      <div className="grid gap-3 lg:grid-cols-[1.15fr_1.15fr_auto] lg:items-center">
        <div className="rounded-[22px] border border-sky-200 bg-sky-50/80 p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Backoffice RRHH
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-950">{adminTitle}</div>
          <div className="mt-1 text-sm text-slate-600">{adminDescription}</div>
        </div>

        <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <UserRound className="h-3.5 w-3.5" />
            Portal del colaborador
          </div>
          <div className="mt-3 text-sm font-semibold text-slate-950">{employeeTitle}</div>
          <div className="mt-1 text-sm text-slate-600">{employeeDescription}</div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild className="rounded-2xl">
            <Link href={primaryHref}>{primaryLabel}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl bg-white/90">
            <Link href={secondaryHref} className="inline-flex items-center gap-2">
              {secondaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}