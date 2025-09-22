import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const params = new URLSearchParams()
  const isAccessible = url.searchParams.get('is_accessible')
  const hasColiving = url.searchParams.get('has_coliving')
  const bbox = url.searchParams.get('bbox')
  const page = url.searchParams.get('page')
  const maxPrice = url.searchParams.get('price_max')

  if (bbox) params.append('bbox', bbox)
  if (page) params.append('page', page)
  if (maxPrice) params.append('price_max', maxPrice)
  params.append('is_accessible', isAccessible === 'true' ? 'true' : 'false')
  params.append('has_coliving', hasColiving === 'true' ? 'true' : 'false')

  const response = await fetch(`${process.env.API_URL}/accommodations/${params.size > 0 ? `?${params.toString()}` : ''}`)
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to retrieve accomodations' }, { status: response.status })
  }
  const data = await response.json()
  return NextResponse.json(data)
}
