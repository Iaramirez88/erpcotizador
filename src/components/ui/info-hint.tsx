import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type InfoHintProps = {
  content: ReactNode
  label?: string
  className?: string
  iconClassName?: string
}

export function InfoHint({
  content,
  label = 'Ver información',
  className,
  iconClassName,
}: InfoHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition-colors hover:border-sky-200 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
            className,
          )}
        >
          <Info className={cn('h-3.5 w-3.5', iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-md text-[11px] leading-4">
        {content}
      </TooltipContent>
    </Tooltip>
  )
}