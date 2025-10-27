import 'next-auth'

declare module 'next-auth' {
  interface Session extends TSession {
    accessToken?: string
    refreshToken?: string
    error?: string
  }

  interface User {
    accessToken?: string
    refreshToken?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}
