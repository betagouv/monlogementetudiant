import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()

  const response = await fetch(`${process.env.API_URL}/territories/newsletter/subscribe/`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })
  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to subscribe to newsletter' }, { status: response.status })
  }
  const data = await response.json()
  return NextResponse.json(data)
}
