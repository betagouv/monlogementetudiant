import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { randomUUID } from 'crypto'
import { env } from '~/server/env'

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

const bucket = env.S3_BUCKET

/**
 * Les clés des médias sont des UUID (cf. `generateAccommodationKey`) : une photo remplacée
 * reçoit une nouvelle clé, le contenu d'une clé donnée ne change donc jamais. `immutable`
 * est sûr, et c'est ce `max-age` que `next/image` reprend pour le TTL de ses dérivées —
 * sans lui il retomberait sur `minimumCacheTTL`, soit 4 h.
 *
 * 15552000 s = 180 jours.
 */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=15552000, immutable'

/**
 * Préfixe des dérivées écrites par le cache handler Next (cache-handler.mjs). Ces objets
 * ne sont référencés par aucune ligne en base : les balayages du bucket doivent les
 * ignorer plutôt que les prendre pour des orphelins.
 */
export const IMAGE_CACHE_PREFIX = `image-cache/`

/** Préfixe des archives NDJSON déposées par `purge-logs` — même remarque. */
export const PURGE_ARCHIVE_PREFIX = `purges/`

export async function uploadFile(input: { key: string; body: Buffer; contentType: string }): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      ACL: 'public-read',
    }),
  )

  return `${publicBaseUrl()}${input.key}`
}

function publicBaseUrl(): string {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '')
  return `${endpoint.replace('://', `://${bucket}.`)}/`
}

export function keyFromPublicUrl(url: string): string | null {
  const base = publicBaseUrl()
  return url.startsWith(base) ? url.slice(base.length) : null
}

/**
 * Dépose un objet **non public** (pas d'ACL `public-read`, contrairement à `uploadFile` qui
 * sert les médias des résidences). Réservé aux contenus qui ne doivent être lisibles qu'avec
 * les identifiants du bucket : archives de purge, exports internes.
 *
 * Ne retourne pas d'URL publique : l'objet n'est accessible qu'authentifié.
 */
export async function uploadPrivateFile(input: {
  key: string
  body: Buffer
  contentType: string
  metadata?: Record<string, string>
}): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: input.metadata,
    }),
  )
}

export function generateAccommodationKey(ext: string): string {
  const uuidHex = randomUUID().replace(/-/g, '')
  return `accommodations/${uuidHex}.${ext}`
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  )
}
