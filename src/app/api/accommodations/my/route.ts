import { NextResponse } from 'next/server'
import { getServerSession } from '~/auth'

export async function GET(request: Request) {
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()

  if (searchParams.get('page')) params.append('page', searchParams.get('page')!)
  if (searchParams.get('has_availability')) params.append('has_availability', searchParams.get('has_availability')!)
  if (searchParams.get('search')) params.append('search', searchParams.get('search')!)

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${params.size > 0 ? `?${params.toString()}` : ''}`, {
    headers: {
      Authorization: `Bearer ${auth.session.accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to retrieve my accommodations' }, { status: response.status })
  }

  const data = await response.json()
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const auth = await getServerSession()
  if (!auth || !auth.session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()

    const response = await fetch(`${process.env.API_URL}/accommodations/my/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.session.accessToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.text()
      return NextResponse.json({ error: errorData }, { status: response.status })
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
