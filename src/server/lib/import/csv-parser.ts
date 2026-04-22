export interface CsvRow {
  [key: string]: string
}

export function toDigit(value: string | undefined, canBeZero = false): number | null {
  if (!value) return null
  const cleaned = value.replace(/€/g, '').replace(/,/g, '.').replace(/\s/g, '').trim()
  if (cleaned === '') return null
  const num = Number.parseInt(cleaned, 10)
  if (Number.isNaN(num)) return null
  if (num === 0 && !canBeZero) return null
  return num
}

export function toBool(value: string | undefined): boolean | null {
  if (!value || value.trim() === '') return null
  const v = value.trim().toLowerCase()
  return ['oui', 'vrai', 'true', '1', 'yes'].includes(v)
}

export function normalizeEnum(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed === '' ? null : trimmed
}

function detectSeparator(headerLine: string): string {
  const semicolons = headerLine.split(';').length
  const commas = headerLine.split(',').length
  return semicolons >= commas ? ';' : ','
}

function parseCsvLine(line: string, separator: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === separator) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function splitCsvRows(content: string): string[] {
  const rows: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          current += '""'
          i++
        } else {
          inQuotes = false
          current += ch
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
      current += ch
    } else if (ch === '\n') {
      const trimmed = current.replace(/\r$/, '')
      if (trimmed !== '') rows.push(trimmed)
      current = ''
    } else {
      current += ch
    }
  }
  const trimmed = current.replace(/\r$/, '')
  if (trimmed !== '') rows.push(trimmed)
  return rows
}

export function parseCsvContent(content: string, limit?: number): CsvRow[] {
  // Strip BOM
  const cleaned = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content

  const lines = splitCsvRows(cleaned)
  if (lines.length < 2) return []

  const separator = detectSeparator(lines[0])
  const headers = parseCsvLine(lines[0], separator).map((h) => h.trim())
  const rows: CsvRow[] = []

  for (let i = 1; i < lines.length; i++) {
    if (limit && rows.length >= limit) break
    const fields = parseCsvLine(lines[i], separator)
    const row: CsvRow = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j]?.trim() ?? ''
    }
    rows.push(row)
  }

  return rows
}

export function generateSourceId(row: CsvRow): string {
  if (row.code && row.code.trim() !== '') return row.code.trim()
  const key = `${row.name ?? ''}|${row.address ?? ''}|${row.postal_code ?? ''}`
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
