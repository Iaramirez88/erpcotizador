export type CompetitorBenchmark = {
  vendor: string
  focus: string
  pricingModel: 'PUBLIC_PER_USER' | 'PUBLIC_SUITE' | 'QUOTE_BASED'
  publicPriceLabel: string
  benchmarkNote: string
}

export const USD_TO_COP_REFERENCE = 4100

export const TARGET_COMMERCIAL_SEGMENT = {
  employeesRange: '20-80 colaboradores',
  activeUsersRange: '8-25 usuarios activos',
  market: 'PYME y mid-market en Colombia con procesos comerciales, operativos y administrativos ya formales',
} as const

export const MARKET_PRICING_BENCHMARKS: CompetitorBenchmark[] = [
  {
    vendor: 'Odoo',
    focus: 'ERP modular all-in-one',
    pricingModel: 'PUBLIC_PER_USER',
    publicPriceLabel: 'USD 8.95 a USD 13.60 por usuario/mes',
    benchmarkNote: 'Publica tarifa abierta y cobra por usuario, con todas las apps incluidas en el plan.',
  },
  {
    vendor: 'Salesforce',
    focus: 'CRM enterprise',
    pricingModel: 'PUBLIC_PER_USER',
    publicPriceLabel: 'USD 25 a USD 175 por usuario/mes en Sales; ediciones altas llegan a USD 350+',
    benchmarkNote: 'El CRM enterprise escala rápido por usuario y luego suma add-ons, soporte y analítica.',
  },
  {
    vendor: 'Buk',
    focus: 'RRHH y finanzas',
    pricingModel: 'QUOTE_BASED',
    publicPriceLabel: 'Sin tarifa pública abierta',
    benchmarkNote: 'Opera por cotización y exhibe un catálogo de módulos de RRHH muy parecido al frente comercial que estamos armando.',
  },
  {
    vendor: 'Siesa',
    focus: 'ERP regional y nómina',
    pricingModel: 'QUOTE_BASED',
    publicPriceLabel: 'Sin tarifa pública abierta',
    benchmarkNote: 'Segmenta por soluciones empresariales y SBS, pero empuja a registro comercial para conocer el valor.',
  },
  {
    vendor: 'SAP Business One',
    focus: 'ERP pyme enterprise',
    pricingModel: 'QUOTE_BASED',
    publicPriceLabel: 'Sin tarifa pública abierta',
    benchmarkNote: 'Se presenta como ERP asequible para toda la empresa, pero la compra real depende de partner y alcance.',
  },
  {
    vendor: 'Oracle Fusion ERP',
    focus: 'ERP enterprise cloud',
    pricingModel: 'QUOTE_BASED',
    publicPriceLabel: 'Sin tarifa pública abierta',
    benchmarkNote: 'El posicionamiento es enterprise; el sitio oficial lleva a demo y contacto comercial, no a tarifa de autoservicio.',
  },
] as const

export const SGDIGITAL_PRICING_POSITIONING = {
  summary:
    'SGDigital debe venderse como suite por empresa con precio muy por debajo de Salesforce/SAP/Oracle y por encima de un Odoo base cuando ya existe operación local, verticales y acompañamiento comercial.',
  rules: [
    'Los submódulos deben ser una puerta de entrada accesible para cierres rápidos o dolores puntuales.',
    'Los módulos padre deben ahorrar entre 15% y 30% frente a la suma individual de submódulos.',
    'La suite global debe quedar por debajo de comprar todos los padres por separado, pero no tan baja que canibalice el plan Full más RRHH.',
    'RRHH debe defenderse por profundidad funcional y cercanía al catálogo de Buk, no por guerra de precios absoluta.',
  ],
} as const

export function getPublicBenchmarkBandsCOP() {
  const odooStandardUserMonthlyCOP = Math.round(8.95 * USD_TO_COP_REFERENCE)
  const odooCustomUserMonthlyCOP = Math.round(13.6 * USD_TO_COP_REFERENCE)
  const salesforceStarterUserMonthlyCOP = Math.round(25 * USD_TO_COP_REFERENCE)
  const salesforceProUserMonthlyCOP = Math.round(100 * USD_TO_COP_REFERENCE)
  const salesforceEnterpriseUserMonthlyCOP = Math.round(175 * USD_TO_COP_REFERENCE)

  return {
    odooStandardUserMonthlyCOP,
    odooCustomUserMonthlyCOP,
    salesforceStarterUserMonthlyCOP,
    salesforceProUserMonthlyCOP,
    salesforceEnterpriseUserMonthlyCOP,
  }
}

export function getPublicBenchmarkScenariosCOP(users: number[]) {
  const bands = getPublicBenchmarkBandsCOP()

  return users.map((userCount) => ({
    userCount,
    odooCustomMonthlyCOP: bands.odooCustomUserMonthlyCOP * userCount,
    salesforceProMonthlyCOP: bands.salesforceProUserMonthlyCOP * userCount,
    salesforceEnterpriseMonthlyCOP: bands.salesforceEnterpriseUserMonthlyCOP * userCount,
  }))
}