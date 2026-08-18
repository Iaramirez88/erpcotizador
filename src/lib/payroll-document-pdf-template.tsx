type PayrollDocumentPdfCoreProps = {
  pdf: {
    Document: any
    Page: any
    Text: any
    View: any
    StyleSheet: any
    Image?: any
  }
  company: {
    name: string
    nit?: string | null
    address?: string | null
    phone?: string | null
    logoUrl?: string | null
  }
  document: {
    title: string
    legalFormName?: string | null
    category: string
    documentType: string
    employeeName: string
    employeeDocument: string
    employeeRole: string
    periodLabel?: string | null
    requestedAt?: string | null
    deliveredAt?: string | null
    signedAt?: string | null
    expiresAt?: string | null
    formSummary?: string | null
    notes?: string | null
    hrApprovalStatus: string
    hrApproverName?: string | null
    hrApprovedAt?: string | null
    directorApprovalStatus: string
    directorApproverName?: string | null
    directorApprovedAt?: string | null
    signatureStatus: string
    approvalStatus: string
  }
}

function row(label: string, value?: string | null) {
  return { label, value: value?.trim() || '—' }
}

export function PayrollDocumentPDFCore({ pdf, company, document }: PayrollDocumentPdfCoreProps) {
  const { Document, Page, Text, View, StyleSheet, Image } = pdf

  const styles = StyleSheet.create({
    page: {
      backgroundColor: '#ffffff',
      padding: 32,
      fontSize: 10,
      color: '#0f172a',
      fontFamily: 'Helvetica',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: '#dbe4f0',
      paddingBottom: 14,
    },
    logo: {
      width: 72,
      height: 72,
      objectFit: 'contain',
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 10,
      color: '#475569',
      marginBottom: 2,
    },
    badge: {
      alignSelf: 'flex-start',
      marginTop: 6,
      borderWidth: 1,
      borderColor: '#bfdbfe',
      backgroundColor: '#eff6ff',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 9,
      color: '#1d4ed8',
      fontWeight: 700,
    },
    section: {
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      borderRadius: 14,
      padding: 14,
      backgroundColor: '#f8fafc',
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      marginBottom: 8,
      color: '#0f172a',
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cell: {
      width: '48%',
      marginBottom: 8,
    },
    label: {
      fontSize: 8,
      textTransform: 'uppercase',
      color: '#64748b',
      marginBottom: 3,
    },
    value: {
      fontSize: 10,
      color: '#0f172a',
    },
    bodyText: {
      fontSize: 10,
      lineHeight: 1.5,
      color: '#334155',
    },
    signatureGrid: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 6,
    },
    signatureCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#cbd5e1',
      borderRadius: 12,
      padding: 10,
      backgroundColor: '#ffffff',
      minHeight: 92,
    },
    footer: {
      marginTop: 8,
      fontSize: 8,
      color: '#64748b',
      textAlign: 'center',
    },
  })

  const employeeRows = [
    row('Empleado', document.employeeName),
    row('Documento', document.employeeDocument),
    row('Cargo', document.employeeRole),
    row('Periodo', document.periodLabel),
  ]

  const lifecycleRows = [
    row('Solicitado', document.requestedAt),
    row('Entregado', document.deliveredAt),
    row('Firmado', document.signedAt),
    row('Vence', document.expiresAt),
  ]

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{document.title}</Text>
            <Text style={styles.subtitle}>{document.legalFormName || 'Documento laboral'}</Text>
            <Text style={styles.subtitle}>{company.name}{company.nit ? ` · NIT ${company.nit}` : ''}</Text>
            <Text style={styles.subtitle}>{document.category} · {document.documentType}</Text>
            <Text style={styles.badge}>Estado global: {document.approvalStatus}</Text>
          </View>
          {company.logoUrl && Image ? <Image src={company.logoUrl} style={styles.logo} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identificación del colaborador</Text>
          <View style={styles.grid}>
            {employeeRows.map((item) => (
              <View key={item.label} style={styles.cell}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen del documento</Text>
          <Text style={styles.bodyText}>{document.formSummary || document.notes || 'Documento generado desde la plataforma de nómina para revisión, aprobación y firma interna.'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trazabilidad</Text>
          <View style={styles.grid}>
            {lifecycleRows.map((item) => (
              <View key={item.label} style={styles.cell}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.value}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aprobaciones y firma</Text>
          <View style={styles.signatureGrid}>
            <View style={styles.signatureCard}>
              <Text style={styles.label}>RRHH</Text>
              <Text style={styles.value}>Estado: {document.hrApprovalStatus}</Text>
              <Text style={styles.value}>Responsable: {document.hrApproverName || 'Pendiente'}</Text>
              <Text style={styles.value}>Fecha: {document.hrApprovedAt || '—'}</Text>
            </View>
            <View style={styles.signatureCard}>
              <Text style={styles.label}>Dirección</Text>
              <Text style={styles.value}>Estado: {document.directorApprovalStatus}</Text>
              <Text style={styles.value}>Responsable: {document.directorApproverName || 'Pendiente'}</Text>
              <Text style={styles.value}>Fecha: {document.directorApprovedAt || '—'}</Text>
            </View>
            <View style={styles.signatureCard}>
              <Text style={styles.label}>Colaborador</Text>
              <Text style={styles.value}>Estado firma: {document.signatureStatus}</Text>
              <Text style={styles.value}>Soporte: firma dentro de plataforma</Text>
              <Text style={styles.value}>Fecha: {document.signedAt || '—'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>{company.address || 'SGDigital Softwares'}{company.phone ? ` · ${company.phone}` : ''}</Text>
      </Page>
    </Document>
  )
}