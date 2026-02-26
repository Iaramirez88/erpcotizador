import React from 'react'
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

import CotizacionPDFCore, {
  type CotizacionPDFProps,
  type CotizacionPdfData,
  type CotizacionPdfItem,
  type CotizacionPdfMaterial,
} from '@/lib/pdf-template'

export type { CotizacionPDFProps, CotizacionPdfData, CotizacionPdfItem, CotizacionPdfMaterial } from '@/lib/pdf-template'

export default function CotizacionPDF(props: CotizacionPDFProps) {
  return (
    <CotizacionPDFCore
      pdf={{ Document, Image, Page, Text, View, StyleSheet }}
      {...props}
    />
  )
}
