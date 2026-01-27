import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint } from 'better-auth/api'
import { getCookieCache, setSessionCookie } from 'better-auth/cookies'
import { devLog } from '~/lib/dev-log'

export interface TUser {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
  role: 'admin' | 'owner' | 'user'
}

export interface TokensData {
  accessToken: string
  refreshToken: string
  accessTokenExpires: number
}

export interface AuthResult {
  success: boolean
  user?: TUser
  tokens?: TokensData
  error?: string
}

const fiveteenMinutes = 15 * 60 * 1000

function getTokenExpiration(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000
  } catch {
    return Date.now() + fiveteenMinutes
  }
}

export async function validateMagicLink(sesame: string): Promise<AuthResult> {
  try {
    const response = await fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/check/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sesame }),
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid magic link' }
    }

    const data = await response.json()

    const user: TUser = {
      id: data.user.id,
      email: data.user.email,
      firstname: data.user.first_name,
      lastname: data.user.last_name,
      name: `${data.user.first_name} ${data.user.last_name}`.trim(),
      role: data.user.role,
    }

    const tokens: TokensData = {
      accessToken: data.access,
      refreshToken: data.refresh,
      accessTokenExpires: getTokenExpiration(data.access),
    }

    return { success: true, user, tokens }
  } catch {
    return { success: false, error: 'Authentication failed' }
  }
}

export async function validateCredentials(email: string, password: string): Promise<AuthResult> {
  try {
    const response = await fetch(`${process.env.API_URL}/accounts/students/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      return { success: false, error: 'Invalid credentials' }
    }

    const data = await response.json()

    const user: TUser = {
      id: data.user.id,
      email: data.user.email,
      firstname: data.user.first_name,
      lastname: data.user.last_name,
      name: `${data.user.first_name} ${data.user.last_name}`.trim(),
      role: data.user.role,
    }

    const tokens: TokensData = {
      accessToken: data.access,
      refreshToken: data.refresh,
      accessTokenExpires: getTokenExpiration(data.access),
    }

    return { success: true, tokens, user }
  } catch {
    return { success: false, error: 'Authentication failed' }
  }
}

export const externalAuthPlugin = () => {
  return {
    id: 'external-auth',
    schema: {
      session: {
        fields: {
          accessToken: { type: 'string', required: false },
          refreshToken: { type: 'string', required: false },
          accessTokenExpires: { type: 'number', required: false },
          firstname: { type: 'string', required: false },
          lastname: { type: 'string', required: false },
          name: { type: 'string', required: false },
          role: { type: 'string', required: false },
        },
      },
    } as const,
    endpoints: {
      signInMagicLink: createAuthEndpoint('/external-auth/signin/magic-link', { method: 'GET' }, async (ctx) => {
        const sesame = ctx.query?.sesame as string | undefined
        const callbackUrl = (ctx.query?.callbackUrl as string) || '/bailleur/tableau-de-bord'
        const errorUrl = (ctx.query?.errorUrl as string) || '/verification/erreur'

        if (!sesame) {
          return ctx.redirect(errorUrl)
        }

        const result = await validateMagicLink(sesame)

        if (!result.success || !result.user || !result.tokens) {
          return ctx.redirect(errorUrl)
        }

        const session = await ctx.context.internalAdapter.createSession(result.user.id, false, {
          ...result.tokens,
          firstname: result.user.firstname,
          lastname: result.user.lastname,
          name: result.user.name,
          role: result.user.role,
        })

        if (!session) {
          return ctx.redirect(errorUrl)
        }

        await setSessionCookie(ctx, {
          session,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: true,
          },
        })

        return ctx.redirect(callbackUrl)
      }),

      // Credentials signin - used by login form
      signInCredentials: createAuthEndpoint('/external-auth/signin/credentials', { method: 'POST' }, async (ctx) => {
        const body = ctx.body as { email?: string; password?: string; callbackUrl?: string }
        const { email, password, callbackUrl = '/mon-espace' } = body

        if (!email || !password) {
          return ctx.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const result = await validateCredentials(email, password)

        if (!result.success || !result.user || !result.tokens) {
          return ctx.json({ error: result.error || 'Authentication failed' }, { status: 401 })
        }

        const session = await ctx.context.internalAdapter.createSession(result.user.id, false, {
          ...result.tokens,
          firstname: result.user.firstname,
          lastname: result.user.lastname,
          name: result.user.name,
          role: result.user.role,
        })

        if (!session) {
          return ctx.json({ error: 'Failed to create session' }, { status: 500 })
        }

        await setSessionCookie(ctx, {
          session,
          user: {
            id: result.user.id,
            email: result.user.email,
            name: result.user.name,
            createdAt: new Date(),
            updatedAt: new Date(),
            emailVerified: true,
          },
        })

        return ctx.json({
          success: true,
          user: result.user,
          callbackUrl,
        })
      }),

      // -- internal endpoint for proxy to update session after token refresh
      refreshSession: createAuthEndpoint(
        '/external-auth/refresh',
        { method: 'POST', metadata: { isAction: false, disableCSRFCheck: true } },
        async (ctx) => {
          devLog('[external-auth] Refresh session endpoint called')
          const body = ctx.body as {
            accessToken?: string
            refreshToken?: string
            accessTokenExpires?: number
          }

          devLog('[external-auth] body:', body)
          if (!body.accessToken || !body.refreshToken || !body.accessTokenExpires) {
            return ctx.json({ error: 'Missing token data' }, { status: 400 })
          }

          // Get session token from cookie
          const sessionToken = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret)
          if (!sessionToken) {
            return ctx.json({ error: 'No session found' }, { status: 401 })
          }
          devLog('[external-auth] session token found')

          // For stateless sessions, get session data from cookie cache (not database)
          // Construct headers from request for getCookieCache
          const headers = ctx.headers ?? new Headers()
          const cacheSession = await getCookieCache(headers, {
            cookiePrefix: 'better-auth',
            secret: ctx.context.options.secret,
            strategy: 'jwe',
          })

          if (!cacheSession?.session || !cacheSession?.user) {
            devLog('[external-auth] No cache session found')
            return ctx.json({ error: 'No cache session found' }, { status: 401 })
          }
          devLog('[external-auth] cacheSession found for user:', cacheSession.user.id)

          const updatedSessionData = {
            ...cacheSession.session,
            accessToken: body.accessToken,
            refreshToken: body.refreshToken,
            accessTokenExpires: body.accessTokenExpires,
          }

          const newSession = await ctx.context.internalAdapter.createSession(cacheSession.user.id, false, updatedSessionData)

          if (!newSession) {
            devLog('[external-auth] Failed to create new session')
            return ctx.json({ error: 'Failed to create session' }, { status: 500 })
          }
          devLog('[external-auth] New session created:', newSession.id)

          await setSessionCookie(ctx, {
            session: newSession,
            user: cacheSession.user,
          })

          devLog('[external-auth] Session cookie set, refresh complete')
          return ctx.json({ success: true, expiresAt: body.accessTokenExpires })
        },
      ),

      signOutExternal: createAuthEndpoint('/external-auth/signout', { method: 'POST' }, async (ctx) => {
        const body = ctx.body as { callbackUrl?: string }
        const { callbackUrl = '/' } = body

        try {
          // Try to get session from cookie to call backend logout
          const sessionToken = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret)

          if (sessionToken) {
            const session = await ctx.context.internalAdapter.findSession(sessionToken)

            if (session?.session) {
              const sessionData = session.session as {
                accessToken?: string
                refreshToken?: string
                role?: string
              }

              if (sessionData.accessToken && sessionData.refreshToken && sessionData.role) {
                const url =
                  sessionData.role === 'owner'
                    ? `${process.env.API_AUTH_BASE_URL}/admin-auth/logout/`
                    : `${process.env.API_URL}/accounts/students/logout/`

                await fetch(url, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${sessionData.accessToken}`,
                  },
                  body: JSON.stringify({ refresh: sessionData.refreshToken }),
                }).catch(() => {
                  // Silent fail on backend logout
                })
              }
            }
          }
        } catch {
          // Continue with local signout even if backend fails
        }

        // Clear session cookie
        ctx.setCookie(ctx.context.authCookies.sessionToken.name, '', {
          maxAge: 0,
          path: '/',
        })

        return ctx.json({ success: true, callbackUrl })
      }),
    },
  } satisfies BetterAuthPlugin
}
