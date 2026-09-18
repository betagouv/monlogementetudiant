/**
 * Cache handler Next.js — persiste les images optimisées dans S3.
 *
 * Pourquoi : `next/image` écrit ses dérivées dans `.next/cache/images`, sur le disque
 * *éphémère* du container. Avec 4 containers web sur Scalingo, une même vignette est donc
 * réencodée par sharp jusqu'à 4 fois, et tout repart à zéro à chaque deploy ou restart.
 * Ce handler remplace ce cache local par un cache partagé et persistant, adossé au bucket
 * S3 qu'on possède déjà — pas de CDN, pas de fournisseur supplémentaire.
 *
 * Deux étages :
 *   L1 — LRU en mémoire du process, pour éviter un GET S3 par vignette et par visiteur ;
 *   L2 — le bucket S3, partagé par les 4 containers et conservé entre les deploys.
 *
 * Seules les entrées `IMAGE` sont détournées. Tout le reste du cache incrémental (fetch
 * cache des services WordPress / RAMSESE, pages prérendues au build) est délégué tel quel
 * au `FileSystemCache` de Next : ce fichier ne change rien à leur comportement actuel.
 *
 * Contraintes de forme : Next charge ce fichier par `import()` *hors* du graphe de modules
 * de l'application (cf. `next-server.js`, `loadCustomCacheHandlers`). Il n'est donc ni
 * transpilé ni bundlé — d'où le `.mjs`, `process.env` en direct plutôt que `~/server/env`,
 * et la duplication du préfixe S3 défini dans `src/server/services/s3.ts`.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Chemin interne à Next : non couvert par le semver public, à revérifier à chaque montée
// de version majeure. Le garde-fou ci-dessous fait échouer le boot plutôt que de laisser
// le cache se dégrader silencieusement.
const FileSystemCache = require('next/dist/server/lib/incremental-cache/file-system-cache.js').default

if (typeof FileSystemCache !== 'function') {
  throw new Error(
    "cache-handler.mjs : impossible de charger le FileSystemCache de Next. L'API interne a probablement changé — voir la note de montée de version dans ce fichier.",
  )
}

/** Doit rester aligné sur `IMAGE_CACHE_PREFIX` dans `src/server/services/s3.ts`. */
const PREFIX = `image-cache/`

const MEMORY_BUDGET_BYTES = Number(process.env.IMAGE_CACHE_MEMORY_MB ?? 128) * 1024 * 1024

const CONTENT_TYPES = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/**
 * L1 : LRU au niveau du module, donc partagé par les deux instances que Next crée (une
 * pour le cache incrémental, une pour les images). `Map` conserve l'ordre d'insertion :
 * une lecture réinsère la clé en queue, l'éviction pioche en tête.
 */
const memory = new Map()
let memoryBytes = 0

function memoryGet(key) {
  const hit = memory.get(key)
  if (!hit) return null
  memory.delete(key)
  memory.set(key, hit)
  return hit
}

function memorySet(key, entry) {
  const previous = memory.get(key)
  if (previous) memoryBytes -= previous.buffer.byteLength
  memory.set(key, entry)
  memoryBytes += entry.buffer.byteLength

  for (const [oldestKey, oldest] of memory) {
    if (memoryBytes <= MEMORY_BUDGET_BYTES) break
    memory.delete(oldestKey)
    memoryBytes -= oldest.buffer.byteLength
  }
}

let s3Client = null

/**
 * Coupe-circuit : une fois vrai, plus aucun appel S3 n'est tenté pour le reste du process.
 *
 * L'étage S3 n'est qu'une optimisation — sans lui le L1 mémoire suffit et l'optimiseur
 * réencode. Un bucket qui refuse l'écriture (clé en lecture seule, droits changés) ne doit
 * donc pas produire une ligne de log par vignette : on l'abandonne au premier refus.
 */
let s3Disabled = false

/** Un refus de droits ne se répare pas en réessayant : inutile de garder le S3 branché. */
function isPermissionError(error) {
  const status = error?.$metadata?.httpStatusCode
  return status === 401 || status === 403 || error?.name === 'AccessDenied' || error?.Code === 'AccessDenied'
}

function disableS3(reason) {
  if (s3Disabled) return
  s3Disabled = true
  s3Client = null
  console.warn(`[cache-handler] cache S3 des images desactive pour ce process : ${reason}. Le cache memoire prend le relais.`)
}

/**
 * Retourne `null` quand les identifiants S3 sont absents — cas du dev local et des tests,
 * où le cache se contente alors du L1 mémoire.
 *
 * `IMAGE_CACHE_S3_DISABLED=1` force le même comportement même avec des identifiants valides :
 * en local, les clés S3 pointent sur un bucket partagé où l'écriture du préfixe `image-cache/`
 * n'est pas forcément accordée, et le cache partagé n'a de toute façon aucun intérêt sur un
 * poste de développement.
 */
function getS3Client() {
  if (s3Disabled) return null
  if (s3Client) return s3Client

  const { S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, IMAGE_CACHE_S3_DISABLED } = process.env
  if (IMAGE_CACHE_S3_DISABLED === '1' || IMAGE_CACHE_S3_DISABLED === 'true') {
    disableS3('IMAGE_CACHE_S3_DISABLED')
    return null
  }
  if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) return null

  s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION ?? 'gra',
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
    // Un S3 lent ne doit jamais retenir une réponse image : au-delà, on retombe sur un
    // miss et sharp réencode, ce qui reste préférable à une requête qui pend.
    requestHandler: { connectionTimeout: 1000, requestTimeout: 3000 },
    maxAttempts: 2,
  })

  return s3Client
}

function toCacheEntry(value) {
  return {
    buffer: value.buffer,
    etag: value.etag,
    upstreamEtag: value.upstreamEtag,
    extension: value.extension,
    revalidate: value.revalidate,
    lastModified: Date.now(),
  }
}

function toCacheHandlerValue(entry) {
  return {
    lastModified: entry.lastModified,
    value: {
      kind: 'IMAGE',
      etag: entry.etag,
      buffer: entry.buffer,
      extension: entry.extension,
      upstreamEtag: entry.upstreamEtag,
      revalidate: entry.revalidate,
    },
  }
}

export default class MleCacheHandler extends FileSystemCache {
  async get(cacheKey, ctx) {
    if (ctx?.kind !== 'IMAGE') return super.get(cacheKey, ctx)

    const cached = memoryGet(cacheKey)
    if (cached) return toCacheHandlerValue(cached)

    const s3 = getS3Client()
    if (!s3) return null

    try {
      const response = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: PREFIX + cacheKey }))
      const metadata = response.Metadata ?? {}
      const revalidate = Number(metadata.revalidate)
      const entry = {
        buffer: Buffer.from(await response.Body.transformToByteArray()),
        etag: metadata.etag,
        upstreamEtag: metadata['upstream-etag'] || undefined,
        extension: metadata.extension,
        // Un `revalidate` illisible doit laisser l'optimiseur retomber sur son
        // `minimumCacheTTL` : un NaN passerait son test `typeof === 'number'` et rendrait
        // l'entrée éternellement fraîche.
        revalidate: Number.isFinite(revalidate) ? revalidate : undefined,
        lastModified: response.LastModified?.getTime() ?? Date.now(),
      }

      // Une entrée sans métadonnées n'est pas exploitable : l'optimiseur a besoin de
      // l'etag et de l'extension pour répondre. On la traite comme un miss.
      if (!entry.etag || !entry.extension) return null

      memorySet(cacheKey, entry)
      return toCacheHandlerValue(entry)
    } catch (error) {
      // Miss normal (clé absente) comme incident S3 : dans les deux cas l'optimiseur
      // réencode, donc on ne fait pas remonter l'erreur.
      if (isPermissionError(error)) {
        disableS3(`lecture refusee par S3 (${error?.Code ?? error?.name ?? 'AccessDenied'})`)
      } else if (error?.name !== 'NoSuchKey' && error?.$metadata?.httpStatusCode !== 404) {
        console.error(`[cache-handler] lecture S3 échouée pour ${cacheKey}`, error)
      }
      return null
    }
  }

  async set(cacheKey, value, ctx) {
    if (value?.kind !== 'IMAGE') return super.set(cacheKey, value, ctx)

    const entry = toCacheEntry(value)
    memorySet(cacheKey, entry)

    const s3 = getS3Client()
    if (!s3) return

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: PREFIX + cacheKey,
          Body: entry.buffer,
          // Pas d'ACL `public-read` : ce sont des dérivées internes, servies par
          // l'application, jamais adressées directement par le navigateur.
          ContentType: CONTENT_TYPES[entry.extension] ?? 'application/octet-stream',
          Metadata: {
            etag: String(entry.etag),
            'upstream-etag': String(entry.upstreamEtag ?? ''),
            extension: String(entry.extension),
            revalidate: String(entry.revalidate),
          },
        }),
      )
    } catch (error) {
      // Le L1 a déjà l'entrée : l'échec d'écriture coûte un réencodage sur les autres
      // containers, pas une erreur visible par l'utilisateur.
      if (isPermissionError(error)) {
        disableS3(`ecriture refusee par S3 (${error?.Code ?? error?.name ?? 'AccessDenied'})`)
      } else {
        console.error(`[cache-handler] écriture S3 échouée pour ${cacheKey}`, error)
      }
    }
  }
}

/** Exposé pour les tests : permet de repartir d'un L1 vide entre deux cas. */
export const __testing = {
  clearMemory() {
    memory.clear()
    memoryBytes = 0
    s3Disabled = false
    s3Client = null
  },
  isS3Disabled: () => s3Disabled,
  memorySize: () => memory.size,
  memoryBytes: () => memoryBytes,
  PREFIX,
}
