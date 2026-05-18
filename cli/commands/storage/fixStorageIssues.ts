import { DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { env } from '~/server/env'
import { createS3Client } from './findStorageIssues'
import type { BrokenUrl, UnreferencedFile } from './types'

const DELETE_BATCH_SIZE = 1000

export async function fixBrokenUrls(brokenUrls: BrokenUrl[]): Promise<{ accommodationsUpdated: number; urlsRemoved: number }> {
  const byAccommodation = new Map<number, Set<string>>()
  for (const broken of brokenUrls) {
    if (!byAccommodation.has(broken.accommodationId)) {
      byAccommodation.set(broken.accommodationId, new Set())
    }
    byAccommodation.get(broken.accommodationId)!.add(broken.url)
  }

  let accommodationsUpdated = 0
  let urlsRemoved = 0

  for (const [id, brokenSet] of byAccommodation) {
    const [row] = await db.select({ imagesUrls: accommodations.imagesUrls }).from(accommodations).where(eq(accommodations.id, id))

    if (!row) continue

    const currentUrls = row.imagesUrls ?? []
    const newUrls = currentUrls.filter((url) => !brokenSet.has(url))
    const removed = currentUrls.length - newUrls.length

    if (removed === 0) continue

    await db.update(accommodations).set({ imagesUrls: newUrls, imagesCount: newUrls.length }).where(eq(accommodations.id, id))

    accommodationsUpdated++
    urlsRemoved += removed
  }

  return { accommodationsUpdated, urlsRemoved }
}

export async function fixUnreferencedFiles(
  unreferencedFiles: UnreferencedFile[],
): Promise<{ deletedCount: number; errorCount: number; freedBytes: number }> {
  if (unreferencedFiles.length === 0) {
    return { deletedCount: 0, errorCount: 0, freedBytes: 0 }
  }

  const s3 = createS3Client()
  let deletedCount = 0
  let errorCount = 0
  let freedBytes = 0

  for (let i = 0; i < unreferencedFiles.length; i += DELETE_BATCH_SIZE) {
    const batch = unreferencedFiles.slice(i, i + DELETE_BATCH_SIZE)

    try {
      const response = await s3.send(
        new DeleteObjectsCommand({
          Bucket: env.S3_BUCKET,
          Delete: {
            Objects: batch.map((f) => ({ Key: f.key })),
            Quiet: true,
          },
        }),
      )

      const batchErrors = response.Errors?.length ?? 0
      const batchDeleted = batch.length - batchErrors
      deletedCount += batchDeleted
      errorCount += batchErrors
      freedBytes += batch.slice(0, batchDeleted).reduce((sum, f) => sum + f.size, 0)
    } catch {
      errorCount += batch.length
    }
  }

  return { deletedCount, errorCount, freedBytes }
}
