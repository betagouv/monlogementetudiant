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
        Prefix: 'accommodations',
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

export async function findStorageIssues(options: { fetch?: boolean } = {}): Promise<AuditResult> {
  const s3 = createS3Client()
  const baseUrl = getS3BaseUrl()

  const s3Objects = await listAllS3Objects(s3)
  const s3KeySet = new Set(s3Objects.map((o) => o.key))

  const rows = await db
    .select({
      id: accommodations.id,
      name: accommodations.name,
      slug: accommodations.slug,
      imagesUrls: accommodations.imagesUrls,
    })
    .from(accommodations)
    .where(isNotNull(accommodations.imagesUrls))

  const referencedKeys = new Set<string>()
  const brokenUrls: BrokenUrl[] = []
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
        // Clé présente en S3 mais on vérifie que l'URL publique répond 200
        // (ACL mal configuré, mauvaise construction d'URL, etc.)
        const res = await fetch(url, { method: 'HEAD' }).catch(() => null)
        if (!res || !res.ok) {
          brokenUrls.push({
            url,
            key,
            reason: 'http-not-ok',
            httpStatus: res?.status,
            accommodationId: row.id,
            accommodationName: row.name,
            accommodationSlug: row.slug,
          })
        }
      }
    }
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
