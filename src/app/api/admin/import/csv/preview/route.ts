import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'
import { FEATURES } from '~/lib/features'
import { previewCsv } from '~/server/lib/import/csv-importer'
import { getServerSession } from '~/services/better-auth'

export async function POST(request: Request) {
  if (!FEATURES.csvImport) return new Response(null, { status: 404 })

  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const source = formData.get('source') as string | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })
    if (!source?.trim()) return NextResponse.json({ error: 'Identifiant source manquant' }, { status: 400 })

    const content = await file.text()
    const result = previewCsv(content, source.trim())

    return NextResponse.json(result)
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'admin/import/csv/preview' } })
    const message = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
