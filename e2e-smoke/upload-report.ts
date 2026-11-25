import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import slugify from 'slugify'
import { z } from 'zod'
import { E2E_REPORTS_PREFIX } from '../src/server/services/s3-prefixes'
import { baseURL } from './target'

const KEEP_RUNS = 2
const DELETE_BATCH_SIZE = 1000
const RESULTS_FILE = path.join(import.meta.dirname, '..', 'test-results-smoke', 'results.json')

const ZEnv = z.object({
  S3_ENDPOINT: z.url({ message: 'S3_ENDPOINT manquant ou invalide' }),
  S3_REGION: z.string().default('gra'),
  S3_BUCKET: z.string().min(1, { message: 'S3_BUCKET manquant' }),
  S3_ACCESS_KEY_ID: z.string().min(1, { message: 'S3_ACCESS_KEY_ID manquant' }),
  S3_SECRET_ACCESS_KEY: z.string().min(1, { message: 'S3_SECRET_ACCESS_KEY manquant' }),
})

const ZAttachment = z.object({
  name: z.string(),
  contentType: z.string(),
  path: z.string().optional(),
})

const ZTestResult = z.object({
  status: z.string(),
  duration: z.number(),
  attachments: z.array(ZAttachment).default([]),
})

const ZTest = z.object({
  status: z.string(),
  results: z.array(ZTestResult),
})

const ZSpec = z.object({
  title: z.string(),
  file: z.string(),
  tests: z.array(ZTest),
})

type TSuite = {
  title: string
  specs?: z.infer<typeof ZSpec>[]
  suites?: TSuite[]
}

const ZSuite: z.ZodType<TSuite> = z.lazy(() =>
  z.object({
    title: z.string(),
    specs: z.array(ZSpec).optional(),
    suites: z.array(ZSuite).optional(),
  }),
)

const ZResults = z.object({
  suites: z.array(ZSuite),
  stats: z.object({
    startTime: z.string(),
    duration: z.number(),
    expected: z.number(),
    unexpected: z.number(),
    flaky: z.number(),
    skipped: z.number(),
  }),
})

function collectSpecs(suites: TSuite[]): z.infer<typeof ZSpec>[] {
  return suites.flatMap((suite) => [...(suite.specs ?? []), ...collectSpecs(suite.suites ?? [])])
}

async function main() {
  const env = ZEnv.parse(process.env)
  const target = baseURL

  const raw = ZResults.safeParse(JSON.parse(readFileSync(RESULTS_FILE, 'utf-8')))
  if (!raw.success) {
    throw new Error(`Rapport Playwright illisible (${RESULTS_FILE}) : ${raw.error.message}`)
  }
  const { suites, stats } = raw.data

  const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  })

  const startedAt = new Date(stats.startTime)
  const runId = startedAt.toISOString().slice(0, 19).replace(/:/g, '-')
  const runPrefix = `${E2E_REPORTS_PREFIX}${runId}/`

  const specs = collectSpecs(suites)
  const tests: { title: string; file: string; status: string; durationMs: number; video: string | null }[] = []

  for (const [index, spec] of specs.entries()) {
    const test = spec.tests[0]
    const result = test?.results.at(-1)
    const videoPath = result?.attachments.find((a) => a.name === 'video' && a.path)?.path

    let videoKey: string | null = null
    if (videoPath) {
      videoKey = `videos/${String(index + 1).padStart(2, '0')}-${slugify(spec.title, { lower: true, strict: true })}.webm`
      await s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: `${runPrefix}${videoKey}`,
          Body: readFileSync(videoPath),
          ContentType: 'video/webm',
        }),
      )
    }

    tests.push({
      title: spec.title,
      file: spec.file,
      status: test?.status ?? 'unknown',
      durationMs: result?.duration ?? 0,
      video: videoKey,
    })
  }

  const manifest = {
    runAt: startedAt.toISOString(),
    target,
    durationMs: stats.duration,
    stats: { passed: stats.expected, failed: stats.unexpected, flaky: stats.flaky, skipped: stats.skipped },
    tests,
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: `${runPrefix}manifest.json`,
      Body: Buffer.from(JSON.stringify(manifest, null, 2)),
      ContentType: 'application/json',
    }),
  )

  console.log(`Recette déposée : ${runPrefix} (${tests.length} tests, ${tests.filter((t) => t.video).length} vidéos)`)

  await purgeOldRuns(s3, env.S3_BUCKET)
}

async function purgeOldRuns(s3: S3Client, bucket: string) {
  const prefixes: string[] = []
  let continuationToken: string | undefined

  do {
    const response = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: E2E_REPORTS_PREFIX, Delimiter: '/', ContinuationToken: continuationToken }),
    )
    for (const p of response.CommonPrefixes ?? []) {
      if (p.Prefix) prefixes.push(p.Prefix)
    }
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  const expired = prefixes.sort().slice(0, Math.max(0, prefixes.length - KEEP_RUNS))

  for (const prefix of expired) {
    const keys: { Key: string }[] = []
    let continuationToken: string | undefined
    do {
      const objects = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }))
      for (const o of objects.Contents ?? []) {
        if (o.Key) keys.push({ Key: o.Key })
      }
      continuationToken = objects.NextContinuationToken
    } while (continuationToken)

    for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.slice(i, i + DELETE_BATCH_SIZE) } }))
    }
    console.log(`Recette purgée (rétention ${KEEP_RUNS}) : ${prefix}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
