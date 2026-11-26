import type { Metadata } from "next"
import JoinclapPricing from "@/components/joinclap/JoinclapPricing"
import WebsitePageRender from "@/components/website-builder/website-page-render"
import { normalizeWebsiteBuilderData } from "@/lib/website-builder"
import { resolveMainSitePageBySlug } from "@/lib/website-builder-server"
import "../joinclap.css"

export const metadata: Metadata = {
  title: "Precios — Joinclap",
  description:
    "Planes y precios de Joinclap. Elige el plan que se ajusta a tu operación: Básico, Medio, Intermedio o Full.",
  robots: {
    index: true,
    follow: true,
  },
}

export const dynamic = "force-dynamic"

export default async function PreciosPage() {
  const page = await resolveMainSitePageBySlug({ slug: "precios" })

  if (page?.id && page.versions[0]?.id) {
    return (
      <WebsitePageRender
        data={normalizeWebsiteBuilderData(page.versions[0].editorJson)}
        settings={page.websiteProject.themeJson}
        enableScripts
      />
    )
  }

  return <JoinclapPricing />
}
