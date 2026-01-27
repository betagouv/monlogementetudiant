import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSession } from '~/auth'
import { ZPostFavorite } from '~/schemas/favorites/create-favorite'

export async function GET() {
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
      headers: {
        Authorization: `Bearer ${auth.session.accessToken}`,
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
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedData = ZPostFavorite.parse(body)

    const response = await fetch(`${process.env.API_URL}/accommodations/favorites/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedData),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to create favorite' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
