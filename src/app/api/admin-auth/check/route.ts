import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sesame } = await request.json()

    if (!sesame) {
      return NextResponse.json({ error: 'sesame is required' }, { status: 400 })
    }

    const response = await fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/check/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sesame }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Invalid or expired sesame' }, { status: 400 })
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
