"use client"

import Link from "next/link"
import JoinclapHeader from "./JoinclapHeader"
import JoinclapFooter from "./JoinclapFooter"
import { useJoinclapEffects } from "./useJoinclapEffects"

export default function JoinclapPricing() {
  useJoinclapEffects()

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

            <div className="pricing-grid">
              <article className="pricing-card reveal">
                <div className="pricing-name">Básico</div>
                <div className="mono pricing-tag">Para empezar a ordenar</div>
                <div className="pricing-price">$295.000 <small>COP</small></div>
                <div className="pricing-cycle">por mes · 10% dto. anual</div>
                <p className="pricing-desc">Ideal para comenzar a centralizar clientes, ventas y operación en un solo lugar.</p>
                <ul className="pricing-features">
                  <li>2 usuarios</li>
                  <li>1 sede</li>
                  <li>500 clientes · 200 productos</li>
                  <li>300 cotizaciones/mes</li>
                  <li>100 reportes · 100 remisiones</li>
                  <li>100 órdenes de trabajo</li>
                  <li>Litografía, escaneos y terminados sin límite</li>
                </ul>
                <a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20B%C3%A1sico%20de%20Joinclap." target="_blank" rel="noopener">Solicitar demo <span>↗</span></a>
              </article>

              <article className="pricing-card reveal">
                <div className="pricing-name">Medio</div>
                <div className="mono pricing-tag">Escala comercial</div>
                <div className="pricing-price">$650.000 <small>COP</small></div>
                <div className="pricing-cycle">por mes · 10% dto. anual</div>
                <p className="pricing-desc">Escala la operación comercial y logística con más usuarios, sedes y volumen mensual.</p>
                <ul className="pricing-features">
                  <li>Más usuarios y sedes</li>
                  <li>Mayor volumen mensual</li>
                  <li>Todos los módulos operativos</li>
                  <li>Sin CRM omnicanal</li>
                </ul>
                <a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Medio%20de%20Joinclap." target="_blank" rel="noopener">Solicitar demo <span>↗</span></a>
              </article>

                            <article className="pricing-card reveal featured">
                <span className="pricing-badge">Más elegido</span>
                <div className="pricing-name">Intermedio</div>
                <div className="mono pricing-tag">Operación casi ilimitada</div>
                <div className="pricing-price">$1.180.000 <small>COP</small></div>
                <div className="pricing-cycle">por mes · 10% dto. anual</div>
                <p className="pricing-desc">Todo ilimitado salvo unos pocos límites de capacidad, pensado para equipos en crecimiento.</p>
                <ul className="pricing-features">
                  <li>6 sedes</li>
                  <li>10 usuarios</li>
                  <li>8.000 clientes</li>
                  <li>5.000 cotizaciones/mes</li>
                  <li>CRM disponible solo en Full</li>
                </ul>
                <a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Intermedio%20de%20Joinclap." target="_blank" rel="noopener">Solicitar demo <span>↗</span></a>
              </article>

              <article className="pricing-card reveal">
                <div className="pricing-name">Full</div>
                <div className="mono pricing-tag">Sin límites</div>
                <div className="pricing-price">$1.850.000 <small>COP</small></div>
                <div className="pricing-cycle">por mes · 10% dto. anual</div>
                <p className="pricing-desc">Todas las funcionalidades y módulos habilitados, con CRM omnicanal incluido.</p>
                <ul className="pricing-features">
                  <li>Sin límites de capacidad</li>
                  <li>Todos los módulos habilitados</li>
                  <li>CRM omnicanal incluido</li>
                  <li>Máxima capacidad de usuarios y sedes</li>
                </ul>
                <a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20el%20plan%20Full%20de%20Joinclap." target="_blank" rel="noopener">Solicitar demo <span>↗</span></a>
              </article>
            </div>

            <p className="pricing-note">Precios mensuales en pesos colombianos (COP). El pago anual incluye un 10% de descuento. ¿Tienes una operación con necesidades particulares? <Link href="/#contacto" style={{ color: "#638b1b", fontWeight: 700 }}>Conversemos</Link> y armamos un plan a tu medida.</p>
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
