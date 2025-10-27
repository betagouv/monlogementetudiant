import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '~/auth'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sesame = searchParams.get('sesame')

    if (!sesame) {
      return NextResponse.json({ error: 'Sesame parameter is required' }, { status: 400 })
    }

    const result = await signIn('magic-link', {
      sesame,
      redirect: false,
    })

    if (result?.error) {
      return NextResponse.redirect(new URL('/verification/erreur', request.url))
    }

    return NextResponse.redirect(new URL('/preparer-mon-budget-etudiant', request.url))
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
