import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const response = await fetch(`${process.env.API_URL}/accommodations/${slug}/`)
  if (!response.ok) {
    return NextResponse.json({ error: `Failed to retrieve accomodation with slug: ${slug}` }, { status: response.status })
  }
  const data = await response.json()
  return NextResponse.json(data)
}
