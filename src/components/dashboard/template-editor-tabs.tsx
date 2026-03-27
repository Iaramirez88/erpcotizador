'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type TemplateEditorTabOption<T extends string = string> = {
  value: T
  label: string
}

type TemplateEditorTabsProps<T extends string = string> = {
  value: T
  onValueChange: (value: T) => void
  tabs: Array<TemplateEditorTabOption<T>>
  children: ReactNode
  className?: string
  listClassName?: string
  pendingMessage?: string
}

export function TemplateEditorTabs<T extends string = string>({
  value,
  onValueChange,
  tabs,
  children,
  className,
  listClassName,
  pendingMessage = 'Cargando…',
}: TemplateEditorTabsProps<T>) {
  const [tabPending, setTabPending] = useState(false)
  const tabTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (tabTimerRef.current) {
        window.clearTimeout(tabTimerRef.current)
      }
    }
  }, [])

  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => {
        const next = nextValue as T
        if (next === value) return
        setTabPending(true)
        onValueChange(next)
        if (tabTimerRef.current) window.clearTimeout(tabTimerRef.current)
        tabTimerRef.current = window.setTimeout(() => setTabPending(false), 180)
      }}
      className={cn('w-full', className)}
    >
      <TabsList className={cn(listClassName)}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabPending ? <div className="mt-2 text-sm text-muted-foreground">{pendingMessage}</div> : null}
      {children}
    </Tabs>
  )
}
