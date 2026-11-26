import type { Metadata } from "next"
import JoinclapPricing from "@/components/joinclap/JoinclapPricing"
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

export default function PreciosPage() {
  return <JoinclapPricing />
}
