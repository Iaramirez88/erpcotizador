'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrmIntegrationsClient } from './crm-integrations-client'
import { CrmMessagingConsumption } from './crm-messaging-consumption'

export function CrmIntegrationsTabs() {
  const [tab, setTab] = useState('operacion')

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <TabsList className="h-auto flex-wrap rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="operacion" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Operación</TabsTrigger>
          <TabsTrigger value="consumo" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white">Consumo de mensajería</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="operacion">
        <CrmIntegrationsClient />
      </TabsContent>
      <TabsContent value="consumo">
        <CrmMessagingConsumption />
      </TabsContent>
    </Tabs>
  )
}
