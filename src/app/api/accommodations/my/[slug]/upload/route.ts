import { NextResponse } from 'next/server'
import { getServerSession } from '~/auth'
import { generateAccommodationKey, uploadFile } from '~/server/services/s3'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  await params
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: `Type de fichier non supporté: ${file.type}. Types acceptés: jpeg, png, webp` }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `Fichier trop volumineux: ${file.name}. Taille maximale: 10MB` }, { status: 400 })
      }
    }

    const imagesUrls: string[] = []

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const ext = MIME_TO_EXT[file.type] ?? 'jpg'
      const key = generateAccommodationKey(ext)
      const url = await uploadFile({ key, body: buffer, contentType: file.type })
      imagesUrls.push(url)
    }

    return NextResponse.json({ images_urls: imagesUrls })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 })
  }
}
