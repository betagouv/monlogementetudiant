import { NextResponse } from 'next/server'
import { auth } from '~/auth'

export async function DELETE(_request: Request, { params }: { params: { slug: string } }) {
  const session = await auth()
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!params.slug) {
    return NextResponse.json({ error: 'Accommodation slug is required' }, { status: 400 })
  }

  try {
    const response = await fetch(`${process.env.API_URL}/accommodations/favorites/${params.slug}/`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to delete favorite' }, { status: response.status })
    }

    return NextResponse.json({ message: 'Favorite deleted successfully' }, { status: 200 })
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
