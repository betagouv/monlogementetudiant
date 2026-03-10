import { eq } from 'drizzle-orm'
import { cities } from '../../src/server/db/schema'
import { db } from '../lib/db'
import type { SyncCommand, SyncOptions, SyncResult } from '../types'

const CSV_URL = 'https://www.data.gouv.fr/fr/datasets/r/89956da9-5b9b-41d7-8703-18dbec4d54a2'

interface RentRow {
  epci: string
  loypredm2: number
}

function parseCSV(text: string): RentRow[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(';').map((h) => h.trim().replace(/"/g, ''))
  const epciIdx = header.indexOf('EPCI')
  const loyIdx = header.indexOf('loypredm2')

  if (epciIdx === -1 || loyIdx === -1) {
    throw new Error(`CSV headers manquants. Trouvés : ${header.join(', ')}`)
  }

  const rows: RentRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = line.split(';').map((c) => c.trim().replace(/"/g, ''))
    const epci = cols[epciIdx]
    const loypredm2 = Number.parseFloat(cols[loyIdx]?.replace(',', '.'))
    if (epci && !Number.isNaN(loypredm2)) {
      rows.push({ epci, loypredm2 })
    }
  }
  return rows
}

const command: SyncCommand = {
  name: 'rents',
  description: 'Sync des loyers moyens depuis data.gouv.fr',

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    console.log('  📥 Téléchargement du CSV...')
    const response = await fetch(CSV_URL)
    if (!response.ok) throw new Error(`Erreur téléchargement CSV: ${response.status}`)

    // Handle latin1 encoding
    const buffer = Buffer.from(await response.arrayBuffer())
    const text = buffer.toString('latin1')
    const rows = parseCSV(text)
    console.log(`  ✓ ${rows.length} lignes parsées`)

    const rentByEpci = new Map<string, number>()
    for (const row of rows) {
      rentByEpci.set(row.epci, row.loypredm2)
    }

    const allCities = await db.select({ id: cities.id, epciCode: cities.epciCode }).from(cities)

    for (const city of allCities) {
      if (!city.epciCode) {
        result.skipped++
        continue
      }

      const rent = rentByEpci.get(city.epciCode)
      if (rent == null) {
        result.skipped++
        continue
      }

      if (options.dryRun) {
        if (options.verbose) console.log(`    🔍 [dry-run] City ${city.id} → ${rent}€/m²`)
        result.updated++
        continue
      }

      await db.update(cities).set({ averageRent: rent }).where(eq(cities.id, city.id))
      result.updated++
    }

    return result
  },
}

export default command
