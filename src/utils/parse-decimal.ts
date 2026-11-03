const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/

const roundTo2 = (value: number) => Math.round(value * 100) / 100

/** Nombre décimal saisi avec une virgule ou un point (« 29,7 », « 29.7 »), arrondi au centième. */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? roundTo2(value) : null
  if (typeof value !== 'string') return null

  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  if (!DECIMAL_PATTERN.test(cleaned)) return null

  return roundTo2(Number(cleaned))
}

const surfaceFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export const formatSurface = (value: number) => surfaceFormatter.format(value)
