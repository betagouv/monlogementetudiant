import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { env } from '~/server/env'
import { E2E_REPORTS_PREFIX, s3 } from '~/server/services/s3'

const VIDEO_URL_TTL_SECONDS = 12 * 3600

const ZManifest = z.object({
  runAt: z.string(),
  target: z.string(),
  durationMs: z.number(),
  stats: z.object({
    passed: z.number(),
    failed: z.number(),
    flaky: z.number(),
    skipped: z.number(),
  }),
  tests: z.array(
    z.object({
      title: z.string(),
      file: z.string(),
      status: z.string(),
      durationMs: z.number(),
      video: z.string().nullable(),
    }),
  ),
})

type TManifest = z.infer<typeof ZManifest>

export type TE2eReportTest = Omit<TManifest['tests'][number], 'video'> & { videoUrl: string | null }

export type TE2eReport = Omit<TManifest, 'tests'> & { id: string; tests: TE2eReportTest[] }

async function listRunPrefixes(): Promise<string[]> {
  const prefixes: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: env.S3_BUCKET,
        Prefix: E2E_REPORTS_PREFIX,
        Delimiter: '/',
        ContinuationToken: continuationToken,
      }),
    )
    for (const p of response.CommonPrefixes ?? []) {
      if (p.Prefix) prefixes.push(p.Prefix)
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  return prefixes.sort().reverse()
}

async function readManifest(runPrefix: string): Promise<TE2eReport | null> {
  let body: string
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: `${runPrefix}manifest.json` }))
    body = (await response.Body?.transformToString()) ?? ''
  } catch (error) {
    if (error instanceof Error && (error.name === 'NoSuchKey' || error.name === 'NotFound')) return null
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  const manifest = ZManifest.safeParse(parsed)
  if (!manifest.success) return null

  const tests = await Promise.all(
    manifest.data.tests.map(async ({ video, ...test }) => ({
      ...test,
      videoUrl: video
        ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: `${runPrefix}${video}` }), {
            expiresIn: VIDEO_URL_TTL_SECONDS,
          })
        : null,
    })),
  )

  return {
    ...manifest.data,
    id: runPrefix.slice(E2E_REPORTS_PREFIX.length).replace(/\/$/, ''),
    tests,
  }
}

export async function listE2eReports(): Promise<TE2eReport[]> {
  const prefixes = await listRunPrefixes()
  const reports = await Promise.all(prefixes.map(readManifest))
  return reports.filter((report): report is TE2eReport => report !== null)
}
