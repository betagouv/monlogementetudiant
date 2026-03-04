export type UserRole = 'admin' | 'owner' | 'user'

export interface TUser {
  id: string
  email: string
  firstname: string
  lastname: string
  name: string
  role: string
  legacyUser: boolean
}
