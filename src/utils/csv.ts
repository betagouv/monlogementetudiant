/** Colonne d'un export CSV : la clé lue dans la ligne, et l'en-tête affiché. */
export type TCsvColumn<T> = {
  key: keyof T & string
  header: string
}

/** Échappe une valeur pour un CSV à séparateur `;` (le séparateur attendu par Excel en français). */
function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  if (value instanceof Date) return value.toISOString()

  const str = String(value)
  return /[;"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

/**
 * Sérialise des lignes en CSV.
 *
 * Le BOM en tête est indispensable : sans lui, Excel lit le fichier en ANSI et les accents des noms
 * de résidences ressortent illisibles.
 */
export function toCsv<T extends Record<string, unknown>>(columns: TCsvColumn<T>[], rows: T[]): string {
  const lines = [
    columns.map((column) => formatCsvValue(column.header)).join(';'),
    ...rows.map((row) => columns.map((column) => formatCsvValue(row[column.key])).join(';')),
  ]

  return `﻿${lines.join('\n')}`
}
