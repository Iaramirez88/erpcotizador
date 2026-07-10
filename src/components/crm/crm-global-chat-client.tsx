"use client"

import Link from 'next/link'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CrmConversationsClient } from '@/components/crm/crm-conversations-client'
import { CrmTeamChatClient } from '@/components/crm/crm-team-chat-client'

type Props = {
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}

export function CrmGlobalChatClient({ canAccessTeamChat, canAccessCrmChat }: Props) {
  const defaultTab = canAccessTeamChat ? 'team' : 'crm'

  return (
    <div className="space-y-4.5 pb-4">
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
            {canAccessCrmChat ? (
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
                <Link href="/dashboard/crm/agenda">Abrir agenda</Link>
              </Button>
            ) : null}
            {canAccessCrmChat ? (
              <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/85">
                <Link href="/dashboard/crm/conversations">Inbox omnicanal</Link>
              </Button>
            ) : null}
          </>
        }
        stats={[
          ...(canAccessTeamChat ? [{ label: 'Equipo', value: '1:1', hint: 'Chats internos entre compañeros', tone: 'sky' as const }] : []),
          ...(canAccessCrmChat ? [{ label: 'CRM', value: 'Omnicanal', hint: 'Prospectos y clientes del CRM', tone: 'teal' as const }] : []),
          { label: 'Operación', value: 'Centralizada', hint: 'Sin salir del dashboard', tone: 'amber' },
        ]}
      />

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="h-auto rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {canAccessTeamChat ? <TabsTrigger value="team" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Equipo</TabsTrigger> : null}
          {canAccessCrmChat ? <TabsTrigger value="crm" className="rounded-xl px-4 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Prospectos y clientes</TabsTrigger> : null}
        </TabsList>
        {canAccessTeamChat ? <TabsContent value="team" className="space-y-4">
          <CrmTeamChatClient />
        </TabsContent> : null}
        {canAccessCrmChat ? <TabsContent value="crm" className="space-y-4">
          <CrmConversationsClient
            hideHero
            title="Chat con prospectos y clientes"
            description="Responde hilos CRM, asigna conversaciones y sigue oportunidades comerciales desde el panel global."
          />
        </TabsContent> : null}
      </Tabs>
    </div>
  )
}