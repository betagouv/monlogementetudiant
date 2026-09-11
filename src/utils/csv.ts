/** Colonne d'un export CSV : la clé lue dans la ligne, et l'en-tête affiché. */
export type TCsvColumn<T> = {
  key: keyof T & string
  header: string
}

/**
 * Une cellule qui commence par l'un de ces caractères est lue comme une formule par Excel et
 * LibreOffice. On la préfixe alors d'une apostrophe : la valeur reste affichée telle quelle, mais
 * elle n'est plus évaluée.
 */
const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/

/** Échappe une valeur pour un CSV à séparateur `;` (le séparateur attendu par Excel en français). */
function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'oui' : 'non'
  if (value instanceof Date) return value.toISOString()

  // Seules les chaînes sont concernées : un nombre négatif n'est pas une injection de formule.
  const str = typeof value === 'string' && FORMULA_PREFIX.test(value) ? `'${value}` : String(value)

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
