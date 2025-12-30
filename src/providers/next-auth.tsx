'use client'

import { type Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'
import React from 'react'

export type NextAuthProviderProps = {
  children: React.ReactNode
  session?: Session | null
}

export const NextAuthProvider = ({ children, session }: NextAuthProviderProps) => {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
