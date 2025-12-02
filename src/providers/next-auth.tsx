'use client'

import React from 'react'

import { type Session } from 'next-auth'
import { SessionProvider } from 'next-auth/react'

export type NextAuthProviderProps = {
  children: React.ReactNode
  session?: Session | null
}

export const NextAuthProvider = ({ children, session }: NextAuthProviderProps) => {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
