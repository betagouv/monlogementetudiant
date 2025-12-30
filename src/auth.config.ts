import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { TUser } from '~/types/next-auth'

interface User {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
  role: string
}

interface TokenInterface {
  accessToken?: string
  refreshToken?: string
  accessTokenExpires?: number
  error?: string
  user?: User
}

export const fiveteenMinutes = 15 * 60 * 1000
export const fiveMinutes = 5 * 60 * 1000

function getTokenExpiration(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000
  } catch {
    return Date.now() + fiveteenMinutes
  }
}

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
      accessToken: refreshedTokens.access,
      accessTokenExpires: getTokenExpiration(refreshedTokens.access),
      refreshToken: refreshedTokens.refresh,
      error: undefined,
    }
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authConfig = {
  events: {
    async signOut(message) {
      if ('token' in message) {
        const url =
          (message.token?.user as TUser).role === 'owner'
            ? `${process.env.API_AUTH_BASE_URL}/admin-auth/logout/`
            : `${process.env.API_URL}/accounts/students/logout/`

        await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${message.token?.accessToken}`,
          },
          body: JSON.stringify({ refresh: message.token?.refreshToken }),
        })
      }
    },
  },
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
              role: data.user.role,
            },
          }
        } catch {
          return null
        }
      },
    }),
    Credentials({
      id: 'credentials',
      name: 'Credentials Email / Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const response = await fetch(`${process.env.API_URL}/accounts/students/token/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
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
              role: data.user.role,
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
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = getTokenExpiration(user.accessToken)
        token.user = user.user
      }

      // Return previous token if the access token has not expired yet (with 5 min buffer)
      if (Date.now() < (token.accessTokenExpires as number) - fiveMinutes) {
        return token
      } else {
        const refreshedToken = await refreshAccessToken(token as TokenInterface)
        if (refreshedToken.error) {
          return {
            ...token,
            error: refreshedToken.error,
          }
        }
        return {
          ...token,
          accessToken: refreshedToken.accessToken,
          refreshToken: refreshedToken.refreshToken,
          accessTokenExpires: refreshedToken.accessTokenExpires,
          error: undefined,
        }
      }
      return token
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
    signIn: '/se-connecter',
  },
} satisfies NextAuthConfig
