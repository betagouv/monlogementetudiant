import { NextResponse } from 'next/server'
import { auth } from '~/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session || !session.accessToken) {
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

    const backendFormData = new FormData()
    files.forEach((file) => {
      backendFormData.append('images', file)
    })

    const response = await fetch(`${process.env.API_URL}/accommodations/my/${params.slug}/upload/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: backendFormData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      return NextResponse.json({ error: `Failed to upload images: ${errorData}` }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unknown error occurred' }, { status: 500 })
  }
}
