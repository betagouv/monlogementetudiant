import { NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
    token: string
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json()
    const { new_password } = body
    const { id, token } = params

    if (!new_password) {
      return NextResponse.json({ error: 'Missing required field: new_password' }, { status: 400 })
    }

    if (!id || !token) {
      return NextResponse.json({ error: 'Missing required parameters: id and token' }, { status: 400 })
    }

    const response = await fetch(`${process.env.API_URL}/accounts/students/password-reset-confirm/${id}/${token}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_password }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Password reset confirmation failed' }))
      return NextResponse.json({ error: errorData.error || 'Password reset confirmation failed' }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
