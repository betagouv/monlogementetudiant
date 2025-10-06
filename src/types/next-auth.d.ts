import 'next-auth'

interface UserData {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
}

declare module 'next-auth' {
  interface Session {
    accessToken: string
    refreshToken: string
    error: string
    user: UserData
  }

  interface User {
    accessToken: string
    refreshToken: string
    user: UserData
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
    user?: UserData
  }
}
