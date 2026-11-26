"use client"

import { useState } from "react"
import Link from "next/link"
import JoinclapHeader from "./JoinclapHeader"
import JoinclapFooter from "./JoinclapFooter"
import { useJoinclapEffects } from "./useJoinclapEffects"

type BillingPeriod = "mensual" | "anual"

// Descuento aplicado al pago anual.
const ANNUAL_DISCOUNT = 0.1

type Plan = {
  name: string
  tag: string
  monthly: number
  desc: string
  features: string[]
  featured?: boolean
}

const PLANS: Plan[] = [
  { name: "Básico", tag: "Para empezar a ordenar", monthly: 295000, desc: "Ideal para comenzar a centralizar clientes, ventas y operación en un solo lugar.", features: ["2 usuarios", "1 sede", "500 clientes · 200 productos", "300 cotizaciones/mes", "100 reportes · 100 remisiones", "100 órdenes de trabajo", "Litografía, escaneos y terminados sin límite"] },
  { name: "Medio", tag: "Escala comercial", monthly: 650000, desc: "Escala la operación comercial y logística con más usuarios, sedes y volumen mensual.", features: ["Más usuarios y sedes", "Mayor volumen mensual", "Todos los módulos operativos", "Sin CRM omnicanal"] },
  { name: "Intermedio", tag: "Operación casi ilimitada", monthly: 1180000, desc: "Todo ilimitado salvo unos pocos límites de capacidad, pensado para equipos en crecimiento.", features: ["6 sedes", "10 usuarios", "8.000 clientes", "5.000 cotizaciones/mes", "CRM disponible solo en Full"], featured: true },
  { name: "Full", tag: "Sin límites", monthly: 1850000, desc: "Todas las funcionalidades y módulos habilitados, con CRM omnicanal incluido.", features: ["Sin límites de capacidad", "Todos los módulos habilitados", "CRM omnicanal incluido", "Máxima capacidad de usuarios y sedes"] },
]

function formatCOP(value: number) {
  return `$${value.toLocaleString("es-CO")}`
}

export default function JoinclapPricing() {
  useJoinclapEffects()
  const [period, setPeriod] = useState<BillingPeriod>("mensual")

  return (
    <div className="jc">
      <JoinclapHeader current="precios" />

      <main id="inicio">
        <section className="pricing" id="precios">
          <div className="wrap">
            <div className="section-head reveal">
              <div className="mono">Planes & precios</div>
              <div>
                <h2>Un plan para cada <span className="lime">momento de tu negocio.</span></h2>
                <p>Todos los planes incluyen los módulos de Joinclap. La diferencia está en la capacidad y el volumen que tu operación necesita.</p>
              </div>
            </div>

            <div className="pricing-toggle-wrap">
              <div className="pricing-toggle" role="group" aria-label="Periodo de facturación">
                <button type="button" className={period === "mensual" ? "active" : ""} onClick={() => setPeriod("mensual")}>Mensual</button>
                <button type="button" className={period === "anual" ? "active" : ""} onClick={() => setPeriod("anual")}>Anual <span className="pricing-toggle-badge">-10%</span></button>
              </div>
            </div>

            <div className="pricing-grid">
              {PLANS.map((plan) => {
                const monthly = plan.monthly
                const annualMonthly = Math.round(monthly * (1 - ANNUAL_DISCOUNT))
                const annualTotal = annualMonthly * 12
                const annualSavings = monthly * 12 - annualTotal
                const price = period === "anual" ? annualMonthly : monthly
                const whatsappText = `Hola, quiero conocer el plan ${plan.name} de Joinclap.`

                return (
                  <article key={plan.name} className={`pricing-card reveal${plan.featured ? " featured" : ""}`}>
                    {plan.featured ? <span className="pricing-badge">Más elegido</span> : null}
                    <div className="pricing-name">{plan.name}</div>
                    <div className="mono pricing-tag">{plan.tag}</div>
                    <div className="pricing-price">{formatCOP(price)} <small>COP{period === "anual" ? " /mes" : ""}</small></div>
                    <div className="pricing-cycle">{period === "anual" ? `Facturado ${formatCOP(annualTotal)} al año` : "por mes"}</div>
                    {period === "anual" ? <div className="pricing-save">Ahorras {formatCOP(annualSavings)} al año</div> : null}
                    <p className="pricing-desc">{plan.desc}</p>
                    <ul className="pricing-features">
                      {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                    <a className="btn magnetic" href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener">Solicitar demo <span>↗</span></a>
                  </article>
                )
              })}
            </div>

            <p className="pricing-note">
              Precios en pesos colombianos (COP). El pago anual incluye un 10% de descuento. ¿Tienes una operación con necesidades particulares?{" "}
              <Link href="/#contacto" style={{ color: "#638b1b", fontWeight: 700 }}>Conversemos</Link> y armamos un plan a tu medida.
            </p>
          </div>
        </section>

        <section className="cta" id="contacto">
          <div className="wrap reveal">
            <div className="mono">Tu siguiente paso empieza aquí</div>
            <h2>Haz que tu negocio funcione como <span className="lime">un solo equipo.</span></h2>
            <p>Conoce Joinclap y descubre cómo una operación conectada puede cambiar la forma en que trabajas.</p>
            <a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20Joinclap%20y%20agendar%20una%20demo." target="_blank" rel="noopener">Solicitar una demostración <span>↗</span></a>
          </div>
        </section>
      </main>

      <JoinclapFooter />
    </div>
  )
}
