import Link from "next/link"

type JoinclapHeaderProps = {
  current?: "home" | "precios"
}

export default function JoinclapHeader({ current = "home" }: JoinclapHeaderProps) {
  const home = current === "home"

  return (
    <header className="nav">
      <Link className="brand" href="/" aria-label="Joinclap inicio">
        <img src="/brand/logo-joinclap.png" alt="Joinclap" className="brand-logo" />
      </Link>
      <nav className="navlinks" aria-label="Navegación">
        <Link href={home ? "#plataforma" : "/#plataforma"}>Plataforma</Link>
        <Link href={home ? "#red" : "/#red"}>Red operativa</Link>
        <Link href={home ? "#ia" : "/#ia"}>Inteligencia artificial</Link>
        <Link href={home ? "#como-funciona" : "/#como-funciona"}>Cómo funciona</Link>
        <Link href="/precios" className={current === "precios" ? "active" : undefined}>Precios</Link>
      </nav>
      <div className="nav-actions">
        <Link className="nav-login" href="/auth/login">Iniciar sesión</Link>
        <Link className="nav-cta magnetic" href={home ? "#contacto" : "/#contacto"}>
          Solicitar demo <span>↗</span>
        </Link>
      </div>
    </header>
  )
}
