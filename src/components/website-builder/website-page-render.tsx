import { Render, type Data } from '@puckeditor/core'
import { websiteBuilderPuckConfig } from '@/components/website-builder/puck-config'
import { normalizeWebsiteBuilderData } from '@/lib/website-builder'

type Props = {
  data: unknown
}

export default function WebsitePageRender({ data }: Props) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_24%),linear-gradient(180deg,#fffdf6_0%,#ffffff_50%,#f8fafc_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Render config={websiteBuilderPuckConfig} data={normalizeWebsiteBuilderData(data) as Data} />
      </div>
    </div>
  )
}