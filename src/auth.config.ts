import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'

interface User {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
}

interface TokenInterface {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  error?: string
  user?: User
}

export const fiveteenMinutes = 15 * 60 * 1000

async function refreshAccessToken(token: TokenInterface): Promise<TokenInterface> {
  try {
    const response = await fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh: token.refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + fiveteenMinutes,
      refreshToken: refreshedTokens.refresh_token,
    }
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authConfig = {
  providers: [
    Credentials({
      id: 'magic-link',
      name: 'Magic Link',
      credentials: {
        sesame: { label: 'Sesame', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.sesame) return null

        try {
          const response = await fetch(`${process.env.API_AUTH_BASE_URL}/admin-auth/check/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sesame: credentials.sesame }),
          })

          if (!response.ok) return null

          const data = await response.json()

          return {
            accessToken: data.access,
            refreshToken: data.refresh,
            user: {
              id: data.user.id,
              email: data.user.email,
              firstname: data.user.first_name,
              lastname: data.user.last_name,
              name: `${data.user.first_name} ${data.user.last_name}`.trim(),
            },
          }
        } catch {
          return null
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    async jwt({ token, user }: any) {
      if (user) {
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = Date.now() + fiveteenMinutes
        token.user = user.user
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }
      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
    // biome-ignore lint/suspicious/noExplicitAny: TODO
    async session({ session, token }: any) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      session.error = token.error as string
      session.user = token.user
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
} satisfies NextAuthConfig
