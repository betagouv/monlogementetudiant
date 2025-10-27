import { NextResponse } from 'next/server'
import { auth } from '~/auth'

export async function GET(request: Request) {
  const session = await auth()
  if (!session || !session.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const params = new URLSearchParams()

  if (searchParams.get('page')) params.append('page', searchParams.get('page')!)
  if (searchParams.get('has_availability')) params.append('has_availability', searchParams.get('has_availability')!)
  if (searchParams.get('search')) params.append('search', searchParams.get('search')!)

  const response = await fetch(`${process.env.API_URL}/accommodations/my/${params.size > 0 ? `?${params.toString()}` : ''}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
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
