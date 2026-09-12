import { Render, type Data } from '@puckeditor/core'
import { websiteBuilderPuckConfig } from '@/components/website-builder/puck-config'
import { normalizeWebsiteBuilderData } from '@/lib/website-builder'

type Props = {
  data: unknown
}

export default function WebsitePageRender({ data }: Props) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="w-full">
        <Render config={websiteBuilderPuckConfig} data={normalizeWebsiteBuilderData(data) as Data} />
      </div>
    </div>
  )
}