import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstname, lastname, email, password } = body

    if (!firstname || !lastname || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields: first_name, last_name, email, password' }, { status: 400 })
    }

    const payload = {
      first_name: firstname,
      last_name: lastname,
      email,
      password,
    }

    const response = await fetch(`${process.env.API_URL}/accounts/students/register/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Registration failed' })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
