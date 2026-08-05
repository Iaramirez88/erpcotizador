"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CrmConversationsClient } from '@/components/crm/crm-conversations-client'
import { CrmTeamChatClient } from '@/components/crm/crm-team-chat-client'

type Props = {
  canAccessTeamChat: boolean
  canAccessCrmChat: boolean
}

export function CrmGlobalChatClient({ canAccessTeamChat, canAccessCrmChat }: Props) {
  const defaultTab = canAccessTeamChat ? 'team' : 'crm'
  const [activeTab, setActiveTab] = useState<'team' | 'crm'>(defaultTab)

  const sidebarHeader = (
    <div className="space-y-3 rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff,#ffffff)] p-3.5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.24)]">
      <h1 className="text-xl font-semibold tracking-tight text-slate-950">Chats</h1>
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {canAccessTeamChat ? <TabsTrigger value="team" className="rounded-xl px-4 py-2.5 text-slate-600 data-[state=active]:bg-[#1f4aa8] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-[#eef2f7]">Equipo</TabsTrigger> : null}
        {canAccessCrmChat ? <TabsTrigger value="crm" className="rounded-xl px-4 py-2.5 text-slate-600 data-[state=active]:bg-[#1f4aa8] data-[state=active]:text-white data-[state=active]:shadow-sm data-[state=inactive]:bg-[#eef2f7]">Prospectos y clientes</TabsTrigger> : null}
      </TabsList>
    </div>
  )

  return (
    <div className="pb-4">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'team' | 'crm')} className="space-y-0">
        {canAccessTeamChat ? <TabsContent value="team" className="space-y-4">
          <CrmTeamChatClient sidebarHeader={sidebarHeader} />
        </TabsContent> : null}
        {canAccessCrmChat ? <TabsContent value="crm" className="space-y-4">
          <CrmConversationsClient
            hideHero
            sidebarHeader={sidebarHeader}
            title="Chat con prospectos y clientes"
            description="Responde hilos CRM, asigna conversaciones y sigue oportunidades comerciales desde el panel global."
          />
        </TabsContent> : null}
      </Tabs>
    </div>
  )
}