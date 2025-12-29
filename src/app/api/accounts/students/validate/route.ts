import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const validationToken = searchParams.get('validation_token')

    if (!validationToken) {
      return NextResponse.json({ error: 'validation_token parameter is required' }, { status: 400 })
    }

    const response = await fetch(`${process.env.API_URL}/accounts/students/validate/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ validation_token: validationToken }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)

      if (errorData?.detail === 'Student already validated') {
        return NextResponse.redirect(new URL(`${process.env.BASE_URL}/se-connecter`))
      }

      return NextResponse.redirect(new URL(`${process.env.BASE_URL}/verification/erreur`))
    }

    return NextResponse.redirect(new URL(`${process.env.BASE_URL}/se-connecter`))
  } catch {
    return NextResponse.redirect(new URL(`${process.env.BASE_URL}/verification/erreur`))
  }
}
