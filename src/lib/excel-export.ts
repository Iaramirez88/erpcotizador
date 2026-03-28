import ExcelJS from 'exceljs'

export type ExcelSheetSpec = {
  name: string
  rows: Array<Record<string, unknown>>
}

function safeSheetName(name: string): string {
  const trimmed = String(name ?? '').trim() || 'Sheet1'
  // Excel limita a 31 chars y no permite algunos caracteres
  return trimmed
    .slice(0, 31)
    .replace(/[\\/?*\[\]:]/g, '-')
}

function toCellValue(value: unknown): ExcelJS.CellValue {
  if (value == null) return ''
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  return JSON.stringify(value)
}

export async function buildXlsxBuffer(sheets: ExcelSheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(safeSheetName(sheet.name))
    const rows = sheet.rows ?? []
    const headers: string[] = []

    for (const row of rows) {
      for (const key of Object.keys(row ?? {})) {
        if (!headers.includes(key)) headers.push(key)
      }
    }

    if (headers.length === 0) continue

    worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(Math.max(header.length + 4, 14), 40) }))

    for (const row of rows) {
      const normalizedRow = Object.fromEntries(
        headers.map((header) => [header, toCellValue(row?.[header])])
      )
      worksheet.addRow(normalizedRow)
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
}

export function formatDateForFilename(d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
