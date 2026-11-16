import * as fs from 'node:fs'
import * as path from 'node:path'
import { asc, eq, or } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { accommodations, owners } from '~/server/db/schema'
import { descriptionToText, sectionHtmlToText, splitDescription, type TDescriptionSections } from '~/server/lib/description-sections'
import { type TCsvColumn, toCsv } from '~/utils/csv'

interface SplitDescriptionsOptions {
  write?: boolean
  dryRun?: boolean
  verbose?: boolean
  csv?: string | boolean
  owner?: string
  limit?: number
  force?: boolean
}

type TCsvRow = {
  owner: string
  name: string
  description: string
  tagline: string
  locationAndProximity: string
  servicesAndEquipment: string
  receptionAndContact: string
  practicalInfo: string
  otherInformation: string
}

const SECTION_KEYS = [
  'tagline',
  'locationAndProximity',
  'servicesAndEquipment',
  'receptionAndContact',
  'practicalInfo',
  'otherInformation',
] as const satisfies (keyof TDescriptionSections)[]

const SECTION_LABELS: Record<(typeof SECTION_KEYS)[number], string> = {
  tagline: 'Accroche',
  locationAndProximity: 'Localisation et proximité',
  servicesAndEquipment: 'Services et équipements spécifiques',
  receptionAndContact: 'Accueil et contact',
  practicalInfo: 'Modalités pratiques',
  otherInformation: 'Autre',
}

const CSV_COLUMNS: TCsvColumn<TCsvRow>[] = [
  { key: 'owner', header: 'Gestionnaire' },
  { key: 'name', header: 'Nom résidence' },
  { key: 'description', header: 'Description' },
  ...SECTION_KEYS.map((key) => ({ key, header: SECTION_LABELS[key] })),
]

function ownerFilter(owner: string) {
  const id = Number(owner)
  return Number.isInteger(id) ? or(eq(owners.id, id), eq(owners.slug, owner)) : eq(owners.slug, owner)
}

export async function splitDescriptions(options: SplitDescriptionsOptions): Promise<void> {
  const shouldWrite = options.write === true && options.dryRun !== true
  try {
    if (options.write && options.dryRun) console.log('⚠️  --dry-run prioritaire sur --write : aucune écriture')
    else if (!shouldWrite) console.log('🔍 Mode dry-run — utilisez --write pour écrire les rubriques en base')

    const query = db
      .select({
        id: accommodations.id,
        name: accommodations.name,
        slug: accommodations.slug,
        description: accommodations.description,
        ownerName: owners.name,
        tagline: accommodations.tagline,
        locationAndProximity: accommodations.locationAndProximity,
        servicesAndEquipment: accommodations.servicesAndEquipment,
        receptionAndContact: accommodations.receptionAndContact,
        practicalInfo: accommodations.practicalInfo,
        otherInformation: accommodations.otherInformation,
      })
      .from(accommodations)
      .leftJoin(owners, eq(owners.id, accommodations.ownerId))
      .where(options.owner ? ownerFilter(options.owner) : undefined)
      .orderBy(asc(owners.name), asc(accommodations.name))
      .$dynamic()
    const rows = await (options.limit ? query.limit(options.limit) : query)

    const csvRows: TCsvRow[] = []
    const filled: Record<(typeof SECTION_KEYS)[number], number> = {
      tagline: 0,
      locationAndProximity: 0,
      servicesAndEquipment: 0,
      receptionAndContact: 0,
      practicalInfo: 0,
      otherInformation: 0,
    }
    let withDescription = 0
    let written = 0
    let skippedAlreadyFilled = 0

    for (const row of rows) {
      const sections = splitDescription(row.description)
      const texts = Object.fromEntries(
        SECTION_KEYS.map((key) => [key, key === 'tagline' ? (sections.tagline ?? '') : sectionHtmlToText(sections[key])]),
      ) as Record<(typeof SECTION_KEYS)[number], string>

      csvRows.push({
        owner: row.ownerName ?? '',
        name: row.name,
        description: descriptionToText(row.description),
        ...texts,
      })

      if (!row.description?.trim()) continue
      withDescription++
      for (const key of SECTION_KEYS) if (sections[key]) filled[key]++

      if (options.verbose) {
        console.log(`\n#${row.id} ${row.ownerName ?? '—'} / ${row.name} (${row.slug})`)
        for (const key of SECTION_KEYS) {
          if (texts[key]) console.log(`  [${SECTION_LABELS[key]}] ${texts[key].replace(/\n/g, ' ⏎ ').slice(0, 160)}`)
        }
      }

      const alreadyFilled = SECTION_KEYS.some((key) => row[key] !== null)
      if (alreadyFilled && !options.force) {
        skippedAlreadyFilled++
        continue
      }

      if (shouldWrite && SECTION_KEYS.some((key) => sections[key] !== null)) {
        await db.update(accommodations).set(sections).where(eq(accommodations.id, row.id))
        written++
      }
    }

    console.log(`\n📊 ${rows.length} résidence(s), dont ${withDescription} avec une description`)
    for (const key of SECTION_KEYS) console.log(`  ${SECTION_LABELS[key].padEnd(36)} : ${filled[key]}`)
    if (skippedAlreadyFilled > 0) {
      console.log(`  ⏭️  ${skippedAlreadyFilled} résidence(s) déjà découpée(s), ignorée(s) (--force pour écraser)`)
    }
    if (shouldWrite) console.log(`  ✅ ${written} résidence(s) mise(s) à jour`)

    if (options.csv) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const csvPath = typeof options.csv === 'string' ? options.csv : `split-descriptions-${timestamp}.csv`
      fs.mkdirSync(path.dirname(path.resolve(csvPath)), { recursive: true })
      fs.writeFileSync(csvPath, toCsv(CSV_COLUMNS, csvRows), 'utf-8')
      console.log(`\n📄 Rapport CSV : ${path.resolve(csvPath)}`)
    }
  } finally {
    await closeDb()
  }
}
