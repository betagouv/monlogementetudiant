import { CopyObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { env } from '~/server/env'
import { IMAGE_CACHE_PREFIX, IMMUTABLE_CACHE_CONTROL, PURGE_ARCHIVE_PREFIX, s3 } from '~/server/services/s3'

/**
 * Rattrape le `Cache-Control` des médias déjà en place.
 *
 * `uploadFile` pose `IMMUTABLE_CACHE_CONTROL` à l'upload, mais les objets plus anciens
 * n'ont aucun en-tête de cache : les navigateurs revalident,
 * et `next/image` plafonne le TTL de ses dérivées à `minimumCacheTTL` (4 h) au lieu de
 * reprendre le `max-age` amont.
 *
 * S3 n'a pas de mutation d'en-tête en place : la seule voie est un `CopyObject` de l'objet
 * sur lui-même avec `MetadataDirective: REPLACE`. La copie ne conserve ni le type de
 * contenu ni l'ACL, il faut donc les réémettre — d'où le `HeadObject` préalable, qui sert
 * aussi à rendre la commande idempotente et reprenable après interruption.
 */

interface BackfillCacheControlOptions {
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  concurrency?: number
  prefix?: string[]
}

const DEFAULT_CONCURRENCY = 20

/**
 * Le bucket est balayé en entier : les médias sont éparpillés dans une quarantaine de
 * dossiers de premier niveau (un par bailleur historique — `aclef-images/`, `bmh-images/`,
 * `seqens-images/`…, plus quatre variantes de `accommodations`) et jusqu'à la racine. Toute
 * liste blanche se périme au prochain import.
 *
 * Deux garde-fous encadrent ce balayage, parce que le `CopyObject` réémet un ACL
 * `public-read` — obligatoire, la copie repasserait l'objet en privé sinon, et OVH
 * n'implémente pas les bucket policies : l'ACL objet est le seul mécanisme d'accès.
 *
 * 1. Les préfixes gérés par l'application sont exclus. `image-cache/` porte bien un
 *    `ContentType` d'image mais ses dérivées sont délibérément privées (cf. `cache-handler.mjs`),
 *    et `purges/` archive des données supprimées.
 * 2. Tout objet dont le `ContentType` n'est pas `image/*` est ignoré : un bucket balayé en
 *    entier finira par contenir autre chose que des médias, et rien ne doit devenir public
 *    par défaut d'inventaire.
 *
 * Le premier attrape ce que le second laisserait passer, et réciproquement.
 */
const EXCLUDED_PREFIXES = [IMAGE_CACHE_PREFIX, PURGE_ARCHIVE_PREFIX]

const DEFAULT_PREFIXES = ['']

type Outcome = 'updated' | 'skipped' | 'ignored' | 'error'

async function listKeys(prefix: string, limit?: number): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, ContinuationToken: continuationToken }),
    )

    for (const object of response.Contents ?? []) {
      if (object.Key) keys.push(object.Key)
      if (limit && keys.length >= limit) return keys
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return keys
}

/** Les préfixes peuvent se recouvrir (`--prefix ''`), on dédoublonne avant de traiter. */
async function listKeysForPrefixes(prefixes: string[], limit?: number): Promise<string[]> {
  const keys = new Set<string>()

  for (const prefix of prefixes) {
    for (const key of await listKeys(prefix, limit)) {
      // L'exclusion s'applique aussi aux préfixes passés par `--prefix` : ces objets restent privés.
      if (EXCLUDED_PREFIXES.some((excluded) => key.startsWith(excluded))) continue
      keys.add(key)
      if (limit && keys.size >= limit) return [...keys]
    }
  }

  return [...keys]
}

async function backfillKey(key: string, options: BackfillCacheControlOptions): Promise<Outcome> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))

    if (!head.ContentType?.startsWith('image/')) {
      if (options.verbose) console.log(`  🚫 ${key} (${head.ContentType ?? 'type inconnu'})`)
      return 'ignored'
    }

    if (head.CacheControl === IMMUTABLE_CACHE_CONTROL) {
      if (options.verbose) console.log(`  ⏭️  ${key} (déjà à jour)`)
      return 'skipped'
    }

    if (options.dryRun) {
      if (options.verbose) console.log(`  🔍 ${key} (${head.CacheControl ?? 'aucun Cache-Control'})`)
      return 'updated'
    }

    await s3.send(
      new CopyObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        // La source d'un CopyObject se note `bucket/clé`, et la clé doit être encodée :
        // les imports historiques produisent des noms de résidence avec espaces et accents.
        CopySource: `${env.S3_BUCKET}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
        MetadataDirective: 'REPLACE',
        ContentType: head.ContentType,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
        ACL: 'public-read',
      }),
    )

    if (options.verbose) console.log(`  ✅ ${key}`)
    return 'updated'
  } catch (error) {
    console.error(`  ⚠️  ${key} : ${error instanceof Error ? error.message : String(error)}`)
    return 'error'
  }
}

export async function backfillCacheControl(options: BackfillCacheControlOptions): Promise<void> {
  // `??` et non `||` : `--prefix ''` reste une demande explicite de balayer tout le bucket.
  const prefixes = options.prefix ?? DEFAULT_PREFIXES
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  console.log(`🗂️  Backfill Cache-Control sur ${env.S3_BUCKET}`)
  console.log(`   Préfixes : ${prefixes.map((prefix) => prefix || '(bucket entier)').join(', ')}`)
  console.log(`   Exclus   : ${EXCLUDED_PREFIXES.join(', ')} · objets non-image`)
  if (options.dryRun) console.log('   Mode dry-run — aucune écriture S3')

  process.stdout.write('   Listage des objets...')
  const keys = await listKeysForPrefixes(prefixes, options.limit)
  console.log(` ${keys.length} objet(s)`)

  const counts: Record<Outcome, number> = { updated: 0, skipped: 0, ignored: 0, error: 0 }

  for (let i = 0; i < keys.length; i += concurrency) {
    const batch = keys.slice(i, i + concurrency)
    const outcomes = await Promise.all(batch.map((key) => backfillKey(key, options)))
    for (const outcome of outcomes) counts[outcome]++

    if (!options.verbose) {
      process.stdout.write(`\r   Traités [${Math.min(i + concurrency, keys.length)}/${keys.length}]`)
    }
  }

  if (!options.verbose && keys.length > 0) process.stdout.write('\n')

  console.log(
    `\n📊 ${counts.updated} mis à jour · ${counts.skipped} déjà à jour · ${counts.ignored} ignorés (non-image) · ${counts.error} en erreur`,
  )

  // Un objet resté sans Cache-Control continue de faire revalider les navigateurs : on
  // sort en échec pour que le one-off Scalingo le signale plutôt que de passer inaperçu.
  if (counts.error > 0) process.exitCode = 1
}

export const __testing = { listKeys, listKeysForPrefixes, backfillKey, DEFAULT_PREFIXES, EXCLUDED_PREFIXES }
