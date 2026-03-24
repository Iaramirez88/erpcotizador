"use client"

import Link from 'next/link'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CrmConversationsClient } from '@/components/crm/crm-conversations-client'
import { CrmTeamChatClient } from '@/components/crm/crm-team-chat-client'

export function CrmGlobalChatClient() {
  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Chat global' },
        ]}
        eyebrow="CRM Chat"
        title="Panel global de conversaciones"
        description="Alterna entre chat interno de equipo y conversaciones con prospectos o clientes ya capturados en el CRM."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/crm/agenda">Abrir agenda</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
              <Link href="/dashboard/crm/conversations">Inbox omnicanal</Link>
            </Button>
          </>
        }
        stats={[
          { label: 'Equipo', value: '1:1', hint: 'Chats internos entre compañeros', tone: 'sky' },
          { label: 'CRM', value: 'Omnicanal', hint: 'Prospectos y clientes del CRM', tone: 'teal' },
          { label: 'Operación', value: 'Centralizada', hint: 'Sin salir del dashboard', tone: 'amber' },
        ]}
      />

      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger value="team" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Equipo</TabsTrigger>
          <TabsTrigger value="crm" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Prospectos y clientes</TabsTrigger>
        </TabsList>
        <TabsContent value="team" className="space-y-4">
          <CrmTeamChatClient />
        </TabsContent>
        <TabsContent value="crm" className="space-y-4">
          <CrmConversationsClient
            hideHero
            title="Chat con prospectos y clientes"
            description="Responde hilos CRM, asigna conversaciones y sigue oportunidades comerciales desde el panel global."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}