import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { WorkflowEditorClient } from '@/components/workflows/workflow-editor-client'
import { WorkflowRunsClient } from '@/components/workflows/workflow-runs-client'
import { auth } from '@/lib/auth'
import { canAccessCapability } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { parseWorkflowDefinitionJson, parseWorkflowTriggerJson } from '@/lib/workflows'

export default async function WorkflowEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const access = await canAccessCapability({
    domain: 'CAPTACION',
    subdomain: 'WORKFLOWS',
    action: 'READ',
    scope: 'SEDE',
  })
  if (!access.ok) redirect('/dashboard/crm/workflows')

  const { id } = await params
  const workflow = await prisma.workflow.findFirst({ where: { id, empresaId: access.empresaId } })
  if (!workflow) notFound()

  return (
    <div className="space-y-5">
      <WorkflowEditorClient
        initialWorkflow={{
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          webhookToken: workflow.webhookToken,
          trigger: parseWorkflowTriggerJson(workflow.triggerJson),
          definition: parseWorkflowDefinitionJson(workflow.definitionJson),
        }}
      />
      <WorkflowRunsClient workflowId={workflow.id} />
    </div>
  )
}
