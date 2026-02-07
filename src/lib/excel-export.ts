import * as XLSX from 'xlsx'

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

export function buildXlsxBuffer(sheets: ExcelSheetSpec[]): Buffer {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows ?? [])
    XLSX.utils.book_append_sheet(workbook, ws, safeSheetName(sheet.name))
  }

  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export function formatDateForFilename(d: Date = new Date()): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
