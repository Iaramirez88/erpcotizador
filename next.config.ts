import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  // @react-pdf/renderer es ESM-only; sin esto Next intenta cargarlo con `require()`
  // al externalizar dependencias del servidor (y rompe el build/dev con webpack).
  transpilePackages: ["@react-pdf/renderer"],
};

export default nextConfig;
