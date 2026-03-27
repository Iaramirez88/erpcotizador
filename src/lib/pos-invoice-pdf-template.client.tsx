import React from 'react'
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { PosInvoicePDFCore, type PosInvoicePdfProps } from '@/lib/pos-invoice-pdf-template'

export function PosInvoicePDF(props: PosInvoicePdfProps) {
  return (
    <PosInvoicePDFCore
      {...props}
      pdf={{ Document, Page, Text, View, Image, StyleSheet }}
    />
  )
}