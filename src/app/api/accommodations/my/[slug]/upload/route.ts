import * as Sentry from '@sentry/nextjs'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { hasPermission } from '~/server/bailleur/permissions'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { deleteFile, generateAccommodationKey, uploadFile } from '~/server/services/s3'
import { crossOriginForbidden, isSameOriginRequest } from '~/server/utils/same-origin'
import { getServerSession } from '~/services/better-auth'
import { detectMimeType } from '~/utils/detect-mime-type'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_FILE_COUNT = 10
const MAX_TOTAL_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_MULTIPART_OVERHEAD = 1024 * 1024 // 1MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isSameOriginRequest(request)) return crossOriginForbidden()

  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { role, owner } = auth.user

  // Seuls les comptes autorisés à modifier les résidences peuvent alimenter le bucket public.
  if (
    (role !== 'owner' && role !== 'admin') ||
    !hasPermission(
      {
        role,
        bailleurRole: auth.user.bailleurRole ?? null,
        bailleurPermissions: auth.user.bailleurPermissions ?? [],
      },
      'manage_residences',
    )
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { slug } = await params

  if (role !== 'admin' && !owner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Même pour un admin, refuser un slug inexistant afin de ne pas créer d'objets orphelins.
  const accommodationWhere =
    role === 'admin' ? eq(accommodations.slug, slug) : and(eq(accommodations.slug, slug), eq(accommodations.ownerId, owner!.id))
  const [accommodation] = await db.select({ id: accommodations.id }).from(accommodations).where(accommodationWhere).limit(1)
  if (!accommodation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contentLength = Number(request.headers.get('content-length'))
  if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
    return NextResponse.json({ error: 'Content-Length requis' }, { status: 411 })
  }
  if (contentLength > MAX_TOTAL_FILE_SIZE + MAX_MULTIPART_OVERHEAD) {
    return NextResponse.json({ error: 'Requête trop volumineuse' }, { status: 413 })
  }

  try {
    const formData = await request.formData()
    const entries = formData.getAll('images')
    if (entries.length === 0 || entries.some((entry) => !(entry instanceof File))) {
      return NextResponse.json({ error: 'Aucune image valide fournie' }, { status: 400 })
    }
    if (entries.length > MAX_FILE_COUNT) {
      return NextResponse.json({ error: `Trop de fichiers. Maximum: ${MAX_FILE_COUNT}` }, { status: 400 })
    }
    const files = entries as File[]
    const totalSize = files.reduce((sum, file) => sum + file.size, 0)
    if (totalSize > MAX_TOTAL_FILE_SIZE) {
      return NextResponse.json({ error: 'Taille cumulée des fichiers trop importante. Maximum: 50MB' }, { status: 400 })
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Type de fichier non supporté: ${file.type}. Types acceptés: jpeg, png, webp` }, { status: 400 })
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `Fichier trop volumineux: ${file.name}. Taille maximale: 10MB` }, { status: 400 })
      }
    }

    const validatedFiles = []
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())

      const detectedType = detectMimeType(buffer)
      if (!detectedType || !ALLOWED_TYPES.includes(detectedType)) {
        return NextResponse.json({ error: `Contenu de fichier invalide: ${file.name}` }, { status: 400 })
      }

      const ext = MIME_TO_EXT[detectedType] ?? 'jpg'
      const key = generateAccommodationKey(ext)
      validatedFiles.push({ key, buffer, detectedType })
    }

    const imagesUrls: string[] = []
    const uploadedKeys: string[] = []
    try {
      for (const file of validatedFiles) {
        const url = await uploadFile({ key: file.key, body: file.buffer, contentType: file.detectedType })
        uploadedKeys.push(file.key)
        imagesUrls.push(url)
      }
    } catch (error) {
      await Promise.allSettled(uploadedKeys.map((key) => deleteFile(key)))
      throw error
    }

    return NextResponse.json({ imagesUrls })
  } catch (error) {
    Sentry.captureException(error, { tags: { route: 'upload' } })
    return NextResponse.json({ error: "L'upload a échoué" }, { status: 500 })
  }
}
