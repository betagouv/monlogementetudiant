import { eq } from 'drizzle-orm'
import { cities, departments } from '../../src/server/db/schema'
import { db } from '../lib/db'
import type { SyncCommand, SyncOptions, SyncResult } from '../types'

const DATA_URL =
  'https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-atlas_regional-effectifs-d-etudiants-inscrits_agregeables/exports/json'

const ACADEMIC_YEAR = '2023-24'

interface StudentRecord {
  annee_universitaire: string
  com_nom?: string
  com_code?: string
  dp_code?: string
  effectif?: number
  [key: string]: unknown
}

const command: SyncCommand = {
  name: 'students',
  description: "Sync du nombre d'étudiants depuis data.enseignementsup",

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    console.log('  📥 Téléchargement des données...')
    const response = await fetch(DATA_URL)
    if (!response.ok) throw new Error(`Erreur téléchargement: ${response.status}`)

    const records: StudentRecord[] = await response.json()
    console.log(`  ✓ ${records.length} enregistrements récupérés`)

    const filtered = records.filter((r) => r.annee_universitaire === ACADEMIC_YEAR)
    console.log(`  🎓 ${filtered.length} pour l'année ${ACADEMIC_YEAR}`)

    if (!options.dryRun) {
      await db.update(cities).set({ nbStudents: 0 })
    }

    const studentsByInsee = new Map<string, number>()
    const studentsByNameDept = new Map<string, number>()

    for (const record of filtered) {
      const effectif = record.effectif ?? 0
      if (effectif <= 0) continue

      if (record.com_code) {
        const current = studentsByInsee.get(record.com_code) ?? 0
        studentsByInsee.set(record.com_code, current + effectif)
      }

      if (record.com_nom && record.dp_code) {
        const key = `${record.com_nom.toLowerCase()}|${record.dp_code}`
        const current = studentsByNameDept.get(key) ?? 0
        studentsByNameDept.set(key, current + effectif)
      }
    }

    const allCities = await db
      .select({
        id: cities.id,
        name: cities.name,
        inseeCodes: cities.inseeCodes,
        departmentId: cities.departmentId,
      })
      .from(cities)

    const allDepts = await db.select({ id: departments.id, code: departments.code }).from(departments)
    const deptCodeById = new Map(allDepts.map((d) => [d.id, d.code]))

    for (const city of allCities) {
      let students = 0

      // Try matching by INSEE code first
      for (const insee of city.inseeCodes) {
        students += studentsByInsee.get(insee) ?? 0
      }

      // Fallback: match by name + department
      if (students === 0) {
        const deptCode = deptCodeById.get(city.departmentId)
        if (deptCode) {
          const key = `${city.name.toLowerCase()}|${deptCode}`
          students = studentsByNameDept.get(key) ?? 0
        }
      }

      if (students === 0) {
        result.skipped++
        continue
      }

      if (options.dryRun) {
        if (options.verbose) console.log(`    🔍 [dry-run] ${city.name} → ${students} étudiants`)
        result.updated++
        continue
      }

      await db.update(cities).set({ nbStudents: students }).where(eq(cities.id, city.id))
      result.updated++
    }

    return result
  },
}

export default command
