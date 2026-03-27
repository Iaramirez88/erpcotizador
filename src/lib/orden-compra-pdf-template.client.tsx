import React from 'react'
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { OrdenCompraPDFCore, type OrdenCompraPdfProps } from '@/lib/orden-compra-pdf-template'

export function OrdenCompraPDF(props: OrdenCompraPdfProps) {
  return (
    <OrdenCompraPDFCore
      {...props}
      pdf={{ Document, Image, Page, Text, View, StyleSheet }}
    />
  )
}