import { createCallerFactory } from '~/server/trpc/init'
import { appRouter } from '~/server/trpc/router'

const createCaller = createCallerFactory(appRouter)

export const caller = createCaller({ session: null })

export const authenticatedCaller = createCaller({
  session: {
    user: { id: 'test-user-id', email: 'test@test.com', name: 'Test User', firstname: 'Test', lastname: 'User', role: 'user' as const },
    session: {
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      accessTokenExpires: Date.now() + 3600000,
      firstname: 'Test',
      lastname: 'User',
      name: 'Test User',
      role: 'user' as const,
    },
  },
} as Parameters<typeof createCaller>[0])

export const authenticatedCaller2 = createCaller({
  session: {
    user: {
      id: 'test-user-id-2',
      email: 'test2@test.com',
      name: 'Test User 2',
      firstname: 'Test',
      lastname: 'User 2',
      role: 'user' as const,
    },
    session: {
      accessToken: 'test-token-2',
      refreshToken: 'test-refresh-2',
      accessTokenExpires: Date.now() + 3600000,
      firstname: 'Test',
      lastname: 'User 2',
      name: 'Test User 2',
      role: 'user' as const,
    },
  },
} as Parameters<typeof createCaller>[0])
