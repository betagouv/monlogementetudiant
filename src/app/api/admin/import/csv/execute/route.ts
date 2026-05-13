import { TextEncoder } from 'node:util'
import * as Sentry from '@sentry/nextjs'
import { eq } from 'drizzle-orm'
import { FEATURES } from '~/lib/features'
import { db } from '~/server/db'
import { importJobs } from '~/server/db/schema'
import type { CsvProgressEvent } from '~/server/lib/import/csv-importer'
import { executeCsvImport } from '~/server/lib/import/csv-importer'
import { getServerSession } from '~/services/better-auth'

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(request: Request) {
  if (!FEATURES.csvImport) return new Response(null, { status: 404 })

  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const source = formData.get('source') as string | null

  if (!file || !source?.trim()) {
    return new Response('Fichier ou source manquant', { status: 400 })
  }

  const content = await file.text()

  // Create job record
  const [job] = await db
    .insert(importJobs)
    .values({ type: 'csv', status: 'running', source: source.trim(), createdBy: session.user.id })
    .returning({ id: importJobs.id })

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      // Heartbeat to prevent Scalingo 30s idle timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(sseEvent({ type: 'ping' })))
        } catch {
          clearInterval(heartbeat)
        }
      }, 10_000)

      try {
        const onProgress = async (event: CsvProgressEvent) => {
          if (event.type === 'done') {
            const successCount = (event.summary.created ?? 0) + (event.summary.updated ?? 0)
            const errorCount = event.summary.errors?.length ?? 0
            const finalStatus = successCount === 0 && errorCount > 0 ? 'error' : 'done'
            await db
              .update(importJobs)
              .set({ status: finalStatus, summary: event.summary, updatedAt: new Date() })
              .where(eq(importJobs.id, job.id))
          }

          controller.enqueue(encoder.encode(sseEvent({ ...event, jobId: job.id })))
        }

        await executeCsvImport(content, source.trim(), onProgress)
      } catch (error) {
        Sentry.captureException(error, { tags: { route: 'admin/import/csv/execute' } })
        const message = error instanceof Error ? error.message : 'Erreur inconnue'

        await db
          .update(importJobs)
          .set({ status: 'error', summary: { errors: [message] }, updatedAt: new Date() })
          .where(eq(importJobs.id, job.id))

        controller.enqueue(encoder.encode(sseEvent({ type: 'error', message, jobId: job.id })))
      } finally {
        clearInterval(heartbeat)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
