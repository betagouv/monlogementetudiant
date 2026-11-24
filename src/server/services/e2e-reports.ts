import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { env } from '~/server/env'
import { E2E_REPORTS_PREFIX, s3 } from '~/server/services/s3'

const VIDEO_URL_TTL_SECONDS = 3600

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

export type TE2eReportTest = {
  title: string
  file: string
  status: string
  durationMs: number
  videoUrl: string | null
}

export type TE2eReport = {
  id: string
  runAt: string
  target: string
  durationMs: number
  stats: { passed: number; failed: number; flaky: number; skipped: number }
  tests: TE2eReportTest[]
}

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
  } catch {
    return null
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
    manifest.data.tests.map(async (test) => ({
      title: test.title,
      file: test.file,
      status: test.status,
      durationMs: test.durationMs,
      videoUrl: test.video
        ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: `${runPrefix}${test.video}` }), {
            expiresIn: VIDEO_URL_TTL_SECONDS,
          })
        : null,
    })),
  )

  return {
    id: runPrefix.slice(E2E_REPORTS_PREFIX.length).replace(/\/$/, ''),
    runAt: manifest.data.runAt,
    target: manifest.data.target,
    durationMs: manifest.data.durationMs,
    stats: manifest.data.stats,
    tests,
  }
}

export async function listE2eReports(): Promise<TE2eReport[]> {
  const prefixes = await listRunPrefixes()
  const reports = await Promise.all(prefixes.map(readManifest))
  return reports.filter((report): report is TE2eReport => report !== null)
}
