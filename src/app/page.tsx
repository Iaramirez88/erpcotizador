import type { Metadata } from "next"
import JoinclapHome from "@/components/joinclap/JoinclapHome"
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

export default function Home() {
  return <JoinclapHome />
}
