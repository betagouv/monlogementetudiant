import { createCallerFactory } from '~/server/trpc/init'
import { appRouter } from '~/server/trpc/router'

const createCaller = createCallerFactory(appRouter)

export const caller = createCaller({ session: null })

export const authenticatedCaller = createCaller({
  session: {
    user: {
      id: 'test-user-id',
      email: 'test@test.com',
      name: 'Test User',
      firstname: 'Test',
      lastname: 'User',
      role: 'user' as const,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-session-id',
      userId: 'test-user-id',
      token: 'test-token',
      expiresAt: new Date(Date.now() + 3600000),
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-session-id-2',
      userId: 'test-user-id-2',
      token: 'test-token-2',
      expiresAt: new Date(Date.now() + 3600000),
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
} as Parameters<typeof createCaller>[0])

export const ownerCaller = createCaller({
  session: {
    user: {
      id: 'test-owner-id',
      email: 'owner@test.com',
      name: 'Test Owner',
      firstname: 'Test',
      lastname: 'Owner',
      role: 'owner' as const,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-owner-session-id',
      userId: 'test-owner-id',
      token: 'test-owner-token',
      expiresAt: new Date(Date.now() + 3600000),
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
} as Parameters<typeof createCaller>[0])

export const ownerCaller2 = createCaller({
  session: {
    user: {
      id: 'test-owner-id-2',
      email: 'owner2@test.com',
      name: 'Test Owner 2',
      firstname: 'Test',
      lastname: 'Owner 2',
      role: 'owner' as const,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-owner-session-id-2',
      userId: 'test-owner-id-2',
      token: 'test-owner-token-2',
      expiresAt: new Date(Date.now() + 3600000),
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
} as Parameters<typeof createCaller>[0])

export const adminCaller = createCaller({
  session: {
    user: {
      id: 'test-admin-id',
      email: 'admin@test.com',
      name: 'Test Admin',
      firstname: 'Test',
      lastname: 'Admin',
      role: 'admin' as const,
      emailVerified: true,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    session: {
      id: 'test-admin-session-id',
      userId: 'test-admin-id',
      token: 'test-admin-token',
      expiresAt: new Date(Date.now() + 3600000),
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
} as Parameters<typeof createCaller>[0])
