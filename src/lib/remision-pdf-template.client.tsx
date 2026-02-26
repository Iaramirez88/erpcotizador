'use client'

import React from 'react'
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'

import { RemisionPDFCore, type RemisionPDFProps } from '@/lib/remision-pdf-template'

export { type RemisionPDFProps }

export function RemisionPDF(props: RemisionPDFProps) {
  return (
    <RemisionPDFCore
      pdf={{ Document, Page, Text, View, Image, StyleSheet }}
      {...props}
    />
  )
}
