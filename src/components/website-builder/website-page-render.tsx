import { Render, type Data } from '@puckeditor/core'
import { websiteBuilderPuckConfig } from '@/components/website-builder/puck-config'
import { normalizeWebsiteBuilderData } from '@/lib/website-builder'
import { normalizeWebsiteSiteSettings } from '@/lib/website-site-settings'
import WebsiteSiteChrome from '@/components/website-builder/website-site-chrome'

type Props = {
  data: unknown
  settings?: unknown
  enableScripts?: boolean
}

export default function WebsitePageRender({ data, settings, enableScripts = false }: Props) {
  return (
    <WebsiteSiteChrome settings={normalizeWebsiteSiteSettings(settings)} enableScripts={enableScripts}>
      <Render config={websiteBuilderPuckConfig} data={normalizeWebsiteBuilderData(data) as Data} />
    </WebsiteSiteChrome>
  )
}