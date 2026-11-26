"use client"

import JoinclapHeader from "./JoinclapHeader"
import JoinclapFooter from "./JoinclapFooter"
import JoinclapLoginNotice from "./JoinclapLoginNotice"
import { useJoinclapEffects } from "./useJoinclapEffects"

export default function JoinclapHome() {
  useJoinclapEffects()

  return (
    <div className="jc">
      <JoinclapHeader current="home" />

      <main id="inicio">
        <section className="hero" id="hero">
          <div className="hero-3d-scene" aria-hidden="true">
            <div className="scene-grid" />
            <div className="scene-orbit orbit-a" />
            <div className="scene-orbit orbit-b" />
            <div className="scene-core"><div className="core-inner">J<span>·</span></div></div>
            <div className="scene-cube cube-a"><span>CRM</span></div>
            <div className="scene-cube cube-b"><span>ERP</span></div>
            <div className="scene-cube cube-c"><span>AI</span></div>
            <div className="scene-chip chip-a">CLIENTES <b>+128</b></div>
            <div className="scene-chip chip-b">OPERACIÓN <b>EN VIVO</b></div>
          </div>
          <div className="wrap hero-grid">
            <div>
              <div className="eyebrow mono">Una nueva forma de operar</div>
              <h1><span className="line">Tu negocio.</span><span className="line accent">Todo conectado.</span></h1>
              <p className="hero-copy">Joinclap reúne clientes, ventas, inventario, equipos y procesos en una sola plataforma. Un ERP + CRM que trabaja contigo y una red operativa impulsada por inteligencia artificial.</p>
              <div className="hero-actions"><a className="btn magnetic" href="#contacto">Conoce Joinclap <span>↗</span></a><a className="text-link" href="#plataforma">Explorar la plataforma ↓</a></div>
            </div>
            <div className="hero-visual" aria-label="Vista conceptual del panel de Joinclap">
              <div className="orb" />
              <div className="dashboard">
                <div className="dash-top"><div className="dash-brand">joinclap<span className="lime">.</span> <span style={{ color: "#8c9584", fontWeight: 400 }}>workspace</span></div><div className="live">SISTEMA ACTIVO</div></div>
                <div className="dash-title">Resumen de operación</div><div className="dash-sub">Una vista clara de lo que mueve tu negocio</div>
                <div className="metric-grid">
                  <div className="metric"><small>Oportunidades</small><strong>128</strong><em>↗ En seguimiento</em></div>
                  <div className="metric"><small>Órdenes activas</small><strong>36</strong><em>● En proceso</em></div>
                  <div className="metric"><small>Equipo</small><strong>12</strong><em>● Conectado</em></div>
                </div>
                <div className="dash-bottom"><div className="chart"><div className="chart-title">Actividad operativa</div><div className="bars"><i style={{ height: "38%" }} /><i style={{ height: "58%" }} /><i style={{ height: "48%" }} /><i style={{ height: "76%" }} /><i style={{ height: "62%" }} /><i style={{ height: "92%" }} /><i style={{ height: "82%" }} /><i style={{ height: "100%" }} /></div></div><div className="activity"><div className="chart-title">Actividad reciente</div><div className="activity-row"><span className="dot">↗</span> Nueva oportunidad</div><div className="activity-row"><span className="dot">✓</span> Orden actualizada</div><div className="activity-row"><span className="dot">✦</span> Sugerencia IA</div></div></div>
              </div>
              <div className="float-tag tag-one">✦ <b>IA integrada</b> · lista para ayudarte</div><div className="float-tag tag-two">↗ <b>Todo conectado</b> · un solo lugar</div>
            </div>
          </div>
          <div className="scroll-note mono"><span className="scroll-line" /> DESLIZA PARA DESCUBRIR <span className="scroll-line" /></div>
        </section>

                <section className="intro" id="plataforma">
          <div className="wrap">
            <div className="section-head reveal"><div className="mono">01 / La plataforma</div><div><h2>Menos herramientas aisladas. <span className="lime">Más negocio en movimiento.</span></h2><p>Deja de perseguir información entre aplicaciones. Joinclap conecta las áreas de tu empresa para que cada persona sepa qué hacer y cada proceso tenga continuidad.</p></div></div>
            <div className="feature-stack">
              <article className="feature-card reveal"><div className="feature-num">01</div><div><div className="feature-icon">◎</div><h3>CRM & ventas</h3></div><p>Centraliza clientes, conversaciones, oportunidades, cotizaciones y seguimiento comercial. Convierte cada contacto en una relación que avanza.</p></article>
              <article className="feature-card reveal"><div className="feature-num">02</div><div><div className="feature-icon">▦</div><h3>Inventario & operaciones</h3></div><p>Controla productos, existencias, movimientos y sedes. Mantén la información operativa conectada con las decisiones de tu equipo.</p></article>
              <article className="feature-card reveal"><div className="feature-num">03</div><div><div className="feature-icon">↗</div><h3>Órdenes & producción</h3></div><p>Organiza órdenes de trabajo, tareas, proyectos y tiempos. Sigue cada trabajo desde que entra hasta que se entrega.</p></article>
              <article className="feature-card reveal"><div className="feature-num">04</div><div><div className="feature-icon">⌘</div><h3>Equipo & gestión</h3></div><p>Asigna responsables, coordina actividades y consulta el estado de la operación con una visión compartida del negocio.</p></article>
            </div>
          </div>
        </section>

        <section className="network" id="red">
          <div className="wrap network-grid">
            <div className="reveal"><div className="mono">02 / Red operativa</div><h2>No solo conectamos áreas. <span className="lime">Conectamos negocios.</span></h2><p>Joinclap evoluciona más allá de un ERP tradicional: una red operativa donde empresas, equipos y aliados pueden coordinar actividades, compartir oportunidades y construir relaciones de trabajo.</p><p>Un espacio para que las PYMES no tengan que crecer solas.</p><a className="text-link" href="#contacto">Descubre la red operativa ↗</a></div>
            <div className="network-visual reveal"><div className="connector" /><div className="node center">joinclap.</div><div className="node n1">⌂</div><div className="node n2">◎</div><div className="node n3">▦</div><div className="node n4">↗</div></div>
          </div>
        </section>

        <section className="ai" id="ia">
          <div className="wrap ai-layout">
            <div className="ai-panel reveal"><div className="ai-head"><b style={{ fontSize: 13 }}>Joinclap Intelligence</b><span className="ai-pill">✦ IA INTEGRADA</span></div><div className="chat"><div className="bubble user">¿Qué oportunidades necesitan seguimiento hoy?</div><div className="bubble ai">He identificado 8 oportunidades sin actividad reciente. Tres tienen alta probabilidad de cierre. ¿Quieres priorizarlas por valor y fecha de contacto?</div><div className="bubble user">Sí, organiza mi lista.</div><div className="bubble ai">Listo para preparar una vista priorizada con próximos pasos sugeridos.</div></div></div>
            <div className="reveal"><div className="mono">03 / Inteligencia artificial</div><h2>Tu operación también puede <span className="lime">pensar contigo.</span></h2><p>La IA de Joinclap está pensada para ayudarte a consultar información, encontrar patrones, agilizar tareas y tomar mejores decisiones desde el contexto real de tu empresa.</p><div className="ai-points"><div className="ai-point"><b>Asistencia contextual</b><span>Respuestas basadas en la información de tu operación.</span></div><div className="ai-point"><b>Menos tareas manuales</b><span>Apoyo para organizar, resumir y acelerar procesos.</span></div><div className="ai-point"><b>Mejores decisiones</b><span>Información más clara para actuar a tiempo.</span></div><div className="ai-point"><b>Un sistema que evoluciona</b><span>La inteligencia conectada con tus flujos de trabajo.</span></div></div></div>
          </div>
        </section>

                <section className="photo-band">
          <div className="wrap"><div className="photo"><img className="parallax" src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1800&q=85" alt="Equipo de trabajo colaborando alrededor de una mesa" loading="lazy" /><div className="photo-caption"><div className="mono">Una visión compartida</div><h2>El trabajo fluye cuando todo está conectado.</h2><p>Personas, información y procesos avanzando en la misma dirección.</p></div></div></div>
        </section>

        <section className="steps" id="como-funciona">
          <div className="wrap"><div className="section-head reveal"><div className="mono">04 / Empieza a avanzar</div><div><h2>Una plataforma que crece <span className="lime">contigo.</span></h2><p>Empieza por lo que tu empresa necesita hoy. Conecta nuevas áreas y capacidades a medida que tu operación evoluciona.</p></div></div>
            <div className="steps-grid"><article className="step reveal"><div className="mono">PASO 01 / CONECTA</div><h3>Ordena tu operación</h3><p>Centraliza clientes, procesos, tareas y datos en un entorno de trabajo común.</p></article><article className="step reveal"><div className="mono">PASO 02 / COORDINA</div><h3>Activa a tu equipo</h3><p>Define responsables, comparte avances y mantén cada actividad en movimiento.</p></article><article className="step reveal"><div className="mono">PASO 03 / EVOLUCIONA</div><h3>Crece con inteligencia</h3><p>Incorpora automatización e IA para liberar tiempo y tomar mejores decisiones.</p></article></div>
          </div>
        </section>

        <section className="cta" id="contacto"><div className="wrap reveal"><div className="mono">Tu siguiente paso empieza aquí</div><h2>Haz que tu negocio funcione como <span className="lime">un solo equipo.</span></h2><p>Conoce Joinclap y descubre cómo una operación conectada puede cambiar la forma en que trabajas.</p><a className="btn magnetic" href="https://wa.me/?text=Hola%2C%20quiero%20conocer%20Joinclap%20y%20agendar%20una%20demo." target="_blank" rel="noopener">Solicitar una demostración <span>↗</span></a></div></section>
      </main>

      <JoinclapFooter />
      <JoinclapLoginNotice />
    </div>
  )
}
