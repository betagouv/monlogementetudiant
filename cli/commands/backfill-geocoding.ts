import { writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { resolveAddressLocation, type TGeocodeDecision } from '~/server/lib/geocoding/resolve'
import { type TCsvColumn, toCsv } from '~/utils/csv'

/** Une ligne du rapport CSV : les champs de géocodage ne sont remplis que pour les décisions « apply ». */
type TGeocodingCsvRow = {
  slug: string
  code_postal: string
  adresse: string | null
  action: TGeocodeDecision['action']
  confiance: string | null
  motif: string
  lat: number | null
  lng: number | null
  insee: string | null
}

const CSV_COLUMNS: TCsvColumn<TGeocodingCsvRow>[] = [
  { key: 'slug', header: 'slug' },
  { key: 'code_postal', header: 'code_postal' },
  { key: 'adresse', header: 'adresse' },
  { key: 'action', header: 'action' },
  { key: 'confiance', header: 'confiance' },
  { key: 'motif', header: 'motif' },
  { key: 'lat', header: 'lat' },
  { key: 'lng', header: 'lng' },
  { key: 'insee', header: 'insee' },
]

type Phase = 'geom' | 'city' | 'report'

interface BackfillOptions {
  dryRun?: boolean
  verbose?: boolean
  phase?: Phase
  limit?: number
  csv?: string
}

interface AddressRow {
  addressId: number
  slug: string
  address: string | null
  postalCode: string
  cityId: number | null
  cityName: string | null
  /** Commune où tombe réellement le point actuel (null s'il est hors de France). */
  currentInseeCode: string | null
  currentDepartment: string | null
  /** Le point actuel est-il dans la commune de son cityId ? */
  consistent: boolean
}

/**
 * Les adresses dont le point est hors de la commune de leur `cityId`. Ce sont
 * les seules dont la géométrie est à reprendre : une adresse déjà cohérente ne
 * doit jamais être déplacée, sous peine de régression (mesuré à 5 régressions
 * sur 1473 quand on réécrit tout, 0 en restreignant le périmètre).
 */
async function fetchAddresses(onlyInconsistent: boolean, limit?: number): Promise<AddressRow[]> {
  const rows = await db.execute<{
    address_id: string
    slug: string
    address: string | null
    postal_code: string
    city_id: string | null
    city_name: string | null
    current_insee_code: string | null
    current_department: string | null
    consistent: boolean | null
  }>(sql`
    SELECT aa.id                AS address_id,
           a.slug               AS slug,
           aa.address           AS address,
           aa.postal_code       AS postal_code,
           aa.city_id           AS city_id,
           c.name               AS city_name,
           loc.insee_code       AS current_insee_code,
           loc.department       AS current_department,
           CASE WHEN c.boundary IS NULL THEN NULL
                ELSE ST_Within(aa.geom, c.boundary) END AS consistent
    FROM accommodation_address aa
    JOIN accommodation a ON a.id = aa.accommodation_id
    LEFT JOIN city c ON c.id = aa.city_id
    LEFT JOIN LATERAL (
      SELECT c2.insee_codes[1] AS insee_code, d2.code AS department
      FROM city c2
      JOIN department d2 ON d2.id = c2.department_id
      WHERE aa.geom IS NOT NULL AND ST_Within(aa.geom, c2.boundary)
      LIMIT 1
    ) loc ON TRUE
    WHERE aa.postal_code IS NOT NULL
      ${onlyInconsistent ? sql`AND (aa.geom IS NULL OR c.boundary IS NULL OR NOT ST_Within(aa.geom, c.boundary))` : sql``}
    ORDER BY aa.id
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `)

  return rows.map((r) => ({
    addressId: Number(r.address_id),
    slug: r.slug,
    address: r.address,
    postalCode: r.postal_code,
    cityId: r.city_id ? Number(r.city_id) : null,
    cityName: r.city_name,
    currentInseeCode: r.current_insee_code,
    currentDepartment: r.current_department,
    consistent: r.consistent === true,
  }))
}

/** Dump des valeurs actuelles, à rejouer en cas de retour arrière. */
function writeRollback(path: string, rows: { addressId: number }[]): void {
  const ids = rows.map((r) => r.addressId).join(',')
  writeFileSync(
    path,
    [
      '-- Rollback du backfill de géocodage.',
      '-- Rejouer ce SELECT AVANT le backfill pour capturer les valeurs, puis',
      '-- restaurer manuellement depuis le résultat.',
      `SELECT id, ST_AsText(geom) AS geom, city_id FROM accommodation_address WHERE id IN (${ids});`,
      '',
    ].join('\n'),
  )
}

/**
 * Écrit le point et son étiquette ensemble : séparer les deux laisserait
 * l'adresse dans un état où la ville affichée ne correspond pas à la position.
 */
async function applyGeom(addressId: number, lat: number, lng: number, inseeCode: string | null): Promise<void> {
  await db.execute(sql`
    UPDATE accommodation_address aa
    SET geom = ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        city_id = COALESCE(
          ${inseeCode === null ? null : sql`(SELECT c.id FROM city c WHERE c.insee_codes @> ARRAY[${inseeCode}]::varchar[] LIMIT 1)`},
          aa.city_id
        )
    WHERE aa.id = ${addressId}
  `)
}

/** Recale le `city_id` sur la commune du code INSEE validé par la BAN. */
async function applyCityId(addressId: number, inseeCode: string): Promise<boolean> {
  const result = await db.execute<{ id: string }>(sql`
    UPDATE accommodation_address aa
    SET city_id = c.id
    FROM city c
    WHERE aa.id = ${addressId}
      AND c.insee_codes @> ARRAY[${inseeCode}]::varchar[]
      AND (aa.city_id IS NULL OR aa.city_id <> c.id)
    RETURNING aa.id
  `)
  return result.length > 0
}

/**
 * La BAN et nos contours de communes ne s'accordent pas toujours en limite :
 * « 1326 rue de l'Université 62400 » porte le code INSEE de Béthune alors que
 * le point tombe dans Verquigneul, sa voisine, selon `city.boundary`. Écrire
 * un tel couple laisserait l'adresse incohérente, et le rapport la
 * re-proposerait comme corrigeable à chaque passage sans jamais la résoudre.
 *
 * On ne promet donc une correction que si le point retenu tombe réellement
 * dans la commune que la BAN lui attribue.
 */
async function verifyAgainstBoundaries(decision: TGeocodeDecision): Promise<TGeocodeDecision> {
  if (decision.action !== 'apply' || !decision.inseeCode) return decision

  const [match] = await db.execute<{ inside: boolean }>(sql`
    SELECT ST_Within(ST_SetSRID(ST_MakePoint(${decision.lng}, ${decision.lat}), 4326), c.boundary) AS inside
    FROM city c
    WHERE c.insee_codes @> ARRAY[${decision.inseeCode}]::varchar[]
    LIMIT 1
  `)
  // Commune absente de notre table, ou point hors de son contour : dans les
  // deux cas on ne peut pas garantir un couple geom/city_id cohérent.
  if (!match || match.inside !== true) return { action: 'flag', reason: 'boundary-disagreement' }
  return decision
}

/**
 * Code INSEE sur lequel recaler le `city_id`, ou `null` s'il ne faut pas y
 * toucher. La règle est toujours la même : aligner l'étiquette sur la commune
 * où le point tombe, mais uniquement lorsqu'une source indépendante confirme
 * que ce point est le bon. Sans cette corroboration, c'est le point qui est en
 * cause et c'est à la phase `geom` de trancher.
 */
function corroboratedInsee(row: AddressRow, decision: TGeocodeDecision): string | null {
  if (!row.currentInseeCode) return null
  switch (decision.action) {
    // La BAN place l'adresse dans la commune où se trouve déjà le point.
    case 'apply':
      return decision.inseeCode === row.currentInseeCode ? row.currentInseeCode : null
    // `cedex-current-in-dept` : code postal CEDEX, mais la BAN trouve l'adresse
    // dans le département du point. `current-point-in-postcode` : le point est
    // dans une commune du code postal. Dans les deux cas le point tient, et
    // c'est le `city_id` — issu d'un repli arbitraire — qui est à corriger.
    case 'keep':
      return row.currentInseeCode
    case 'flag':
      return null
  }
}

export async function backfillGeocoding(options: BackfillOptions = {}): Promise<void> {
  const { dryRun = true, verbose = false, phase = 'report', limit, csv } = options

  console.log(`→ Backfill géocodage — phase « ${phase} »${dryRun ? ' (DRY-RUN, aucune écriture)' : ''}`)

  try {
    // Toutes les phases se restreignent aux adresses incohérentes — celles dont
    // le point tombe hors de la commune de leur cityId. Réécrire le cityId
    // d'une adresse déjà cohérente désaligne le couple geom/cityId : mesuré à
    // 184 adresses saines cassées sur 186 réétiquetées.
    const rows = await fetchAddresses(true, limit)
    console.log(`→ ${rows.length} adresse(s) à examiner`)

    const decisions: { row: AddressRow; decision: TGeocodeDecision }[] = []
    for (const [index, row] of rows.entries()) {
      const decision = await resolveAddressLocation({
        address: row.address ?? '',
        postalCode: row.postalCode,
        cityName: row.cityName,
        currentInseeCode: row.currentInseeCode,
        currentDepartment: row.currentDepartment,
      })
      // Une adresse sans cityId disparaît de tous les listings (les requêtes
      // joignent `city` en INNER JOIN). On ne devine pas la commune à sa place :
      // le cas doit rester visible pour être corrigé à la main.
      const verified =
        row.cityId === null ? ({ action: 'flag', reason: 'missing-city-id' } as const) : await verifyAgainstBoundaries(decision)
      decisions.push({ row, decision: verified })
      if ((index + 1) % 50 === 0) console.log(`  … ${index + 1}/${rows.length}`)
    }

    const applies = decisions.filter((d) => d.decision.action === 'apply')
    const keeps = decisions.filter((d) => d.decision.action === 'keep')
    const flags = decisions.filter((d) => d.decision.action === 'flag')
    console.log(`\n  apply=${applies.length}  keep=${keeps.length}  flag=${flags.length}`)

    if (csv) {
      const csvRows: TGeocodingCsvRow[] = decisions.map(({ row, decision }) => {
        const apply = decision.action === 'apply' ? decision : null
        return {
          slug: row.slug,
          code_postal: row.postalCode,
          adresse: row.address,
          action: decision.action,
          confiance: apply?.confidence ?? null,
          motif: decision.reason,
          lat: apply?.lat ?? null,
          lng: apply?.lng ?? null,
          insee: apply?.inseeCode ?? null,
        }
      })
      writeFileSync(csv, `${toCsv(CSV_COLUMNS, csvRows)}\n`)
      console.log(`  Rapport écrit dans ${csv}`)
    }

    if (phase === 'report') {
      // Liste exhaustive des adresses incohérentes, à conserver avant le
      // backfill pour pouvoir contrôler le résultat à la main ensuite.
      const label = { apply: 'CORRIGEABLE', keep: 'CONSERVÉE  ', flag: 'MANUELLE   ' } as const
      const order = { flag: 0, keep: 1, apply: 2 } as const
      console.log('\nAdresses incohérentes (point hors de la commune de leur city_id) :\n')
      for (const { row, decision } of [...decisions].sort((a, b) => order[a.decision.action] - order[b.decision.action])) {
        const where = row.currentInseeCode ? `point en ${row.currentInseeCode}` : 'point hors communes'
        console.log(
          `  [${label[decision.action]}] ${row.slug.padEnd(40)} ${row.postalCode}  ${(row.cityName ?? '?').padEnd(24)} ${where.padEnd(22)} ${decision.reason}`,
        )
      }
      console.log(`\n  ${flags.length} adresse(s) à corriger à la main — les autres sont reprises par les phases city puis geom.`)

      // Cas le plus grave : sans cityId, la résidence n'apparaît nulle part.
      const orphans = flags.filter((f) => f.decision.reason === 'missing-city-id')
      if (orphans.length > 0) {
        console.log(`\n  ⚠ ${orphans.length} adresse(s) sans city_id — absentes de tous les listings (INNER JOIN sur city) :`)
        for (const { row } of orphans) {
          const where = row.currentInseeCode ? `point en ${row.currentInseeCode}` : 'point hors communes'
          console.log(`      ${row.slug} (${row.postalCode}) — ${where}`)
        }
      }
      return
    }

    const targets = phase === 'geom' ? applies : decisions.filter((d) => corroboratedInsee(d.row, d.decision) !== null)
    if (!dryRun)
      writeRollback(
        `rollback-geocoding-${phase}.sql`,
        targets.map((t) => t.row),
      )

    let changed = 0
    let unchanged = 0

    for (const { row, decision } of targets) {
      if (phase === 'geom') {
        if (decision.action !== 'apply') continue
        // Filet de sécurité : ne jamais déplacer un point déjà cohérent.
        if (row.consistent) {
          unchanged++
          continue
        }
        if (verbose) console.log(`  ${row.slug} → ${decision.lat.toFixed(5)},${decision.lng.toFixed(5)} (${decision.confidence})`)
        if (!dryRun) await applyGeom(row.addressId, decision.lat, decision.lng, decision.inseeCode)
        changed++
      } else {
        const insee = corroboratedInsee(row, decision)
        if (!insee) {
          unchanged++
          continue
        }
        if (dryRun) {
          const [existing] = await db.execute<{ same: boolean }>(sql`
            SELECT (aa.city_id = c.id) AS same
            FROM accommodation_address aa
            JOIN city c ON c.insee_codes @> ARRAY[${insee}]::varchar[]
            WHERE aa.id = ${row.addressId}
            LIMIT 1
          `)
          if (existing?.same === false) {
            if (verbose) console.log(`  ${row.slug} : city_id → INSEE ${insee}`)
            changed++
          } else unchanged++
        } else if (await applyCityId(row.addressId, insee)) {
          if (verbose) console.log(`  ${row.slug} : city_id → INSEE ${insee}`)
          changed++
        } else unchanged++
      }
    }

    console.log(`\n✓ ${dryRun ? '[dry-run] ' : ''}${changed} ligne(s) modifiée(s), ${unchanged} inchangée(s)`)
    if (!dryRun) console.log(`  Rollback : rollback-geocoding-${phase}.sql`)
  } finally {
    await closeDb()
  }
}
