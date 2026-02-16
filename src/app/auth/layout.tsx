export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden md:flex md:w-1/2 flex-col justify-between p-10 bg-muted">
        <div className="text-2xl font-semibold tracking-tight">Ordex</div>
        <div className="space-y-3">
          <div className="text-xl font-medium">Cotiza. Ordena. Crece.</div>
          <div className="text-sm text-muted-foreground">
            Plataforma para cotización y órdenes de trabajo.
          </div>
        </div>
        <div className="text-xs text-muted-foreground">© {new Date().getFullYear()} Ordex</div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  )
}
