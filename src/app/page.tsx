import type { Metadata } from "next"
import JoinclapHome from "@/components/joinclap/JoinclapHome"
import WebsitePageRender from "@/components/website-builder/website-page-render"
import { normalizeWebsiteBuilderData } from "@/lib/website-builder"
import { resolveMainSitePageBySlug } from "@/lib/website-builder-server"
import "./joinclap.css"

export const metadata: Metadata = {
  title: "Joinclap — Todo tu negocio, en movimiento",
  description:
    "Joinclap conecta ventas, clientes, inventario, equipos y procesos en una plataforma ERP + CRM con inteligencia artificial integrada. Una red operativa para hacer crecer tu empresa.",
  robots: {
    index: true,
    follow: true,
  },
}

export const dynamic = "force-dynamic"

export default async function Home() {
  const page = await resolveMainSitePageBySlug({ slug: "inicio" })

  if (page?.id && page.versions[0]?.id) {
    return (
      <WebsitePageRender
        data={normalizeWebsiteBuilderData(page.versions[0].editorJson)}
        settings={page.websiteProject.themeJson}
        enableScripts
      />
    )
  }

  return <JoinclapHome />
}
