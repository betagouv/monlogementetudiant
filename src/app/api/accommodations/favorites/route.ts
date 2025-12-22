import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '~/auth'

const createFavoriteSchema = z.object({
  accommodation_slug: z.string().min(1, 'accommodation_slug is required'),
})

export async function GET() {
  const session = await auth()
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to retrieve favorites' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (_error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = createFavoriteSchema.parse(body)

    const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to create favorite' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
