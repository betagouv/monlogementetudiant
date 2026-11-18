import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import { db } from '~/server/db'
import { PURGE_ARCHIVE_PREFIX, uploadPrivateFile } from '~/server/services/s3'

/**
 * Format d'archive : **NDJSON gzippé** (une ligne = un objet JSON = une ligne supprimée).
 *
 * Plutôt qu'un dump SQL, un CSV ou du Parquet, parce qu'il :
 * - s'écrit **en flux**, sans matérialiser l'ensemble en mémoire (un run sur `tracking_event`
 *   dépasse le million de lignes dans un conteneur one-off) ;
 * - **survit à une troncature** : un fichier coupé reste lisible jusqu'à sa dernière ligne complète ;
 * - **préserve les types** (`jsonb`, `null`) là où un CSV les aplatirait en chaînes ;
 * - se **relit sans outillage** (`zcat … | jq`, restauration via `jsonb_populate_record`, voir README) ;
 * - compresse d'environ 10:1, sans la dépendance ni l'outillage de lecture qu'imposerait Parquet.
 */
const NDJSON_GZIP_CONTENT_TYPE = 'application/gzip'

/** Taille des pages de lecture : borne la mémoire vive quel que soit le volume purgé. */
const READ_PAGE_SIZE = 5_000

export interface PurgeArchive {
  /** Clé S3 de l'objet déposé. */
  key: string
  /** Nombre de lignes archivées. */
  rows: number
  /** Poids compressé, en octets. */
  bytes: number
  /**
   * Plus grand `id` archivé. La suppression est bornée à cet identifiant pour que l'archive et
   * la purge portent exactement sur le même ensemble de lignes, même si la table reçoit des
   * écritures pendant le run.
   */
  maxId: number
}

interface ArchiveParams {
  table: PgTable & { id: PgColumn; createdAt: PgColumn }
  tableName: string
  /** Condition des lignes à archiver — la même que celle de la suppression. */
  where: SQL
  /** Plafond de lignes pour ce run, pour borner la durée et la mémoire. */
  maxRows: number
  verbose?: boolean
}

/** `purges/tracking_event/2026/08/tracking_event-2026-08-17T03-30-00-000Z.ndjson.gz` */
function archiveKey(tableName: string, now: Date): string {
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return `${PURGE_ARCHIVE_PREFIX}${tableName}/${year}/${month}/${tableName}-${stamp}.ndjson.gz`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/**
 * Lit les lignes condamnées par pages et les pousse dans un flux gzip au format NDJSON.
 *
 * La sérialisation est faite par PostgreSQL (`to_jsonb(...)::text`) : on manipule du texte de
 * bout en bout, sans parser puis re-sérialiser côté Node.
 */
async function buildNdjsonGzip({ table, where, maxRows }: ArchiveParams): Promise<{ body: Buffer; rows: number; maxId: number }> {
  const gzip = createGzip({ level: 9 })
  const chunks: Buffer[] = []
  gzip.on('data', (chunk: Buffer) => chunks.push(chunk))

  let rows = 0
  let maxId = 0

  while (rows < maxRows) {
    const pageSize = Math.min(READ_PAGE_SIZE, maxRows - rows)
    const page = (await db.execute(sql`
      select ${table.id} as id, to_jsonb(${table})::text as row
      from ${table}
      where ${where} and ${table.id} > ${maxId}
      order by ${table.id}
      limit ${pageSize}
    `)) as unknown as { id: string | number; row: string }[]

    if (page.length === 0) break

    if (!gzip.write(`${page.map((entry) => entry.row).join('\n')}\n`)) await once(gzip, 'drain')

    maxId = Number(page[page.length - 1].id)
    rows += page.length
  }

  gzip.end()
  await finished(gzip)

  return { body: Buffer.concat(chunks), rows, maxId }
}

/**
 * Archive dans S3 les lignes qui vont être supprimées, puis retourne de quoi borner la
 * suppression. Retourne `null` si aucune ligne n'est concernée.
 *
 * **L'archive est écrite avant la suppression, et l'échec du dépôt interrompt la purge** : on
 * préfère une table qui grossit un jour de plus à des lignes perdues sans filet.
 */
export async function archivePurgedRows(params: ArchiveParams): Promise<PurgeArchive | null> {
  const { table, tableName, where, verbose } = params

  const { body, rows, maxId } = await buildNdjsonGzip(params)
  if (rows === 0) return null

  // Plage de données couverte : permet de savoir ce que contient une archive sans la
  // décompresser, quand il faut retrouver la bonne dans une liste.
  const [range] = (await db.execute(sql`
    select min(${table.createdAt})::text as oldest, max(${table.createdAt})::text as newest
    from ${table}
    where ${where} and ${table.id} <= ${maxId}
  `)) as unknown as { oldest: string | null; newest: string | null }[]

  const key = archiveKey(tableName, new Date())

  await uploadPrivateFile({
    key,
    body,
    contentType: NDJSON_GZIP_CONTENT_TYPE,
    metadata: {
      table: tableName,
      rows: String(rows),
      'max-id': String(maxId),
      'purged-at': new Date().toISOString(),
      ...(range?.oldest ? { 'data-oldest': range.oldest } : {}),
      ...(range?.newest ? { 'data-newest': range.newest } : {}),
    },
  })

  if (verbose) console.log(`    ↳ archive ${key} (${rows} ligne(s), ${formatBytes(body.byteLength)})`)

  return { key, rows, bytes: body.byteLength, maxId }
}

export const __testing = { archiveKey, formatBytes }
