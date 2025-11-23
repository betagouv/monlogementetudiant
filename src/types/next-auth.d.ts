import 'next-auth'

interface TUser {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
  role: 'admin' | 'owner' | 'user'
}

declare module 'next-auth' {
  interface Session {
    accessToken: string
    refreshToken: string
    error: string
    user: TUser
  }

  interface User {
    accessToken: string
    refreshToken: string
    user: TUser
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
    user?: TUser
  }
}
