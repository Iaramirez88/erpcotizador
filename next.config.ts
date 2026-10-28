import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // @react-pdf/renderer es ESM-only; sin esto Next intenta cargarlo con `require()`
  // al externalizar dependencias del servidor (y rompe el build/dev con webpack).
  transpilePackages: ["@react-pdf/renderer"],

  // NOTA: NO se habilita `typescript.ignoreBuildErrors` ni `eslint.ignoreDuringBuilds`.
  // Un error de tipos debe romper el build (PLAN-MAESTRO-REFACTORIZACION.md §4.9, tarea 1.4).

  // Nómina vive una sola vez en `/dashboard/nomina`. Las rutas heredadas bajo
  // contabilidad se redirigen para evitar dos fuentes de verdad de navegación.
  async redirects() {
    return [
      {
        source: '/dashboard/contabilidad/nomina',
        destination: '/dashboard/nomina',
        permanent: false,
      },
      {
        source: '/dashboard/contabilidad/nomina/:path*',
        destination: '/dashboard/nomina/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
