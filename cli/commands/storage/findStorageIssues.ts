import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { isNotNull } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { env } from '~/server/env'
import type { AuditResult, BrokenUrl, UnreferencedFile } from './types'

export function createS3Client(): S3Client {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  })
}

function getS3BaseUrl(): string {
  const endpoint = env.S3_ENDPOINT.replace(/\/$/, '')
  return `${endpoint.replace('://', `://${env.S3_BUCKET}.`)}/`
}

function extractKeyFromUrl(url: string, baseUrl: string): string | null {
  if (!url.startsWith(baseUrl)) return null
  return url.slice(baseUrl.length)
}

async function listAllS3Objects(s3: S3Client): Promise<Array<{ key: string; size: number; lastModified?: Date }>> {
  const objects: Array<{ key: string; size: number; lastModified?: Date }> = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        ContinuationToken: continuationToken,
      }),
    )

    for (const obj of response.Contents ?? []) {
      if (obj.Key) {
        objects.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified })
      }
    }

    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return objects
}

const HTTP_CONCURRENCY = 20

type UrlCandidate = {
  url: string
  key: string
  accommodationId: number
  accommodationName: string
  accommodationSlug: string
}

async function checkUrlsHttp(candidates: UrlCandidate[], verbose: boolean): Promise<BrokenUrl[]> {
  const broken: BrokenUrl[] = []
  const total = candidates.length

  for (let i = 0; i < total; i += HTTP_CONCURRENCY) {
    const batch = candidates.slice(i, i + HTTP_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (c) => {
        const res = await fetch(c.url, { method: 'HEAD' }).catch(() => null)
        return res?.ok ? null : { ...c, reason: 'http-not-ok' as const, httpStatus: res?.status }
      }),
    )
    for (const r of results) {
      if (r) broken.push(r)
    }
    if (verbose) {
      process.stdout.write(`\r   HTTP [${Math.min(i + HTTP_CONCURRENCY, total)}/${total}]`)
    }
  }

  if (verbose) process.stdout.write('\n')
  return broken
}

export async function findStorageIssues(options: { fetch?: boolean; verbose?: boolean } = {}): Promise<AuditResult> {
  const { verbose = false } = options
  const s3 = createS3Client()
  const baseUrl = getS3BaseUrl()

  if (verbose) process.stdout.write('   Listage des objets S3...')
  const s3Objects = await listAllS3Objects(s3)
  if (verbose) console.log(` ${s3Objects.length} objets trouvés`)

  const s3KeySet = new Set(s3Objects.map((o) => o.key))

  if (verbose) process.stdout.write('   Chargement des résidences en base...')
  const rows = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      imagesUrls: accommodations.imagesUrls,
    })
    .from(accommodations)
    .where(isNotNull(accommodations.imagesUrls))
  if (verbose) console.log(` ${rows.length} résidences avec images`)

  const referencedKeys = new Set<string>()
  const brokenUrls: BrokenUrl[] = []
  const httpCandidates: UrlCandidate[] = []
  let dbUrlsChecked = 0

  for (const row of rows) {
    for (const url of row.imagesUrls ?? []) {
      dbUrlsChecked++
      const key = extractKeyFromUrl(url, baseUrl)
      if (!key) continue // URL externe (OAuth, import externe), on ignore

      referencedKeys.add(key)

      if (!s3KeySet.has(key)) {
        brokenUrls.push({
          url,
          key,
          reason: 'key-not-in-s3',
          accommodationId: row.id,
          accommodationName: row.name,
          accommodationSlug: row.slug,
        })
      } else if (options.fetch) {
        httpCandidates.push({ url, key, accommodationId: row.id, accommodationName: row.name, accommodationSlug: row.slug })
      }
    }
  }

  if (verbose) console.log(`   Cross-référencement : ${dbUrlsChecked} URLs en base, ${brokenUrls.length} clé(s) absente(s) de S3`)

  if (httpCandidates.length > 0) {
    if (verbose) console.log(`   Vérification HTTP de ${httpCandidates.length} URLs (${HTTP_CONCURRENCY} en parallèle)...`)
    const httpBroken = await checkUrlsHttp(httpCandidates, verbose)
    brokenUrls.push(...httpBroken)
  }

  const unreferencedFiles: UnreferencedFile[] = s3Objects
    .filter((o) => !referencedKeys.has(o.key))
    .map((o) => ({ key: o.key, size: o.size, lastModified: o.lastModified }))

  const unreferencedFilesTotalBytes = unreferencedFiles.reduce((sum, f) => sum + f.size, 0)

  return {
    brokenUrls,
    unreferencedFiles,
    stats: {
      s3ObjectsScanned: s3Objects.length,
      dbUrlsChecked,
      brokenUrlsCount: brokenUrls.length,
      unreferencedFilesCount: unreferencedFiles.length,
      unreferencedFilesTotalBytes,
    },
  }
}
