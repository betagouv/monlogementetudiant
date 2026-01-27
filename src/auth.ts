import { BetterAuthOptions, betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { customSession } from 'better-auth/plugins'
import { headers } from 'next/headers'
import { cache } from 'react'
import { externalAuthPlugin, type TUser } from '~/lib/external-auth-plugin'

export const fiveMinutes = 5 * 60

const options = {
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL!, 'http://localhost:3000'],
  session: {
    expiresIn: fiveMinutes,
    updateAge: fiveMinutes,
    freshAge: fiveMinutes,
    cookieCache: {
      enabled: true,
      maxAge: fiveMinutes,
      strategy: 'jwe',
      refreshCache: {
        updateAge: 60,
      },
    },
    storeSessionInDatabase: false,
  },
  account: {
    storeStateStrategy: 'cookie',
    storeAccountCookie: true,
  },
  plugins: [externalAuthPlugin()],
} satisfies BetterAuthOptions

export const auth = betterAuth({
  ...options,
  plugins: [
    ...(options.plugins ?? []),
    customSession(async ({ user, session }) => {
      const sessionData = session as typeof session & {
        accessToken: string
        refreshToken: string
        firstname: string
        lastname: string
        name: string
        role: TUser['role']
      }
      return {
        user: {
          ...user,
          firstname: sessionData.firstname,
          lastname: sessionData.lastname,
          role: sessionData.role,
        },
        session: {
          ...session,
          accessToken: sessionData.accessToken,
          refreshToken: sessionData.refreshToken,
        },
      }
    }),
    nextCookies(),
  ],
})

export const getServerSession = cache(async () => {
  const requestHeaders = await headers()

  const results = await auth.api.getSession({
    headers: requestHeaders,
  })

  return results
})
