import { eq } from 'drizzle-orm'
import { jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '~/server/db'
import { user as userTable } from '~/server/db/schema'
import { syncDossierFacileTenantFromCode } from '~/server/services/dossier-facile/sync'

const STATE_COOKIE_NAME = 'df_oauth_state'

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not set')
  return new TextEncoder().encode(secret)
}

export async function GET(request: Request) {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=missing_params`)
  }

  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get(STATE_COOKIE_NAME)

  if (!tokenCookie) {
    return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=missing_state`)
  }

  let userId: string
  let returnTo: string | undefined
  try {
    const { payload } = await jwtVerify(tokenCookie.value, getJwtSecret())
    if (payload.state !== state) {
      return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=invalid_state`)
    }
    userId = payload.userId as string
    returnTo = payload.returnTo as string | undefined
  } catch {
    return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=expired_state`)
  }

  cookieStore.delete(STATE_COOKIE_NAME)

  try {
    const user = await db.query.user.findFirst({
      where: eq(userTable.id, userId),
    })

    if (!user) {
      return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=user_not_found`)
    }

    await syncDossierFacileTenantFromCode(userId, code, {
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
    })

    const redirectUrl = new URL(returnTo || '/', baseUrl)
    if (redirectUrl.origin !== new URL(baseUrl).origin) {
      redirectUrl.href = new URL('/', baseUrl).href
    }
    redirectUrl.searchParams.set('df_success', '1')
    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    const errorType = error instanceof Error && 'errorType' in error ? (error as { errorType: string }).errorType : 'sync_failed'
    return NextResponse.redirect(`${baseUrl}/dossier-facile/error?error_type=${errorType}`)
  }
}
