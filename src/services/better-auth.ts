import * as Sentry from '@sentry/nextjs'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { hashPassword, verifyPassword as verifyScryptPassword } from 'better-auth/crypto'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'
import { verifyDjangoPassword } from '~/lib/django-password'
import { db } from '~/server/db'
import * as schema from '~/server/db/schema'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { env } from '~/server/env'
import { sendMagicLinkEmail, sendResetPasswordEmail, sendVerificationEmail } from '~/server/services/brevo'

export const oneDay = 24 * 60 * 60

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.BASE_URL,
  trustedOrigins: [env.BASE_URL, 'http://localhost:3000'],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  session: {
    expiresIn: oneDay,
    updateAge: oneDay,
    deferSessionRefresh: true,
  },
  advanced: {
    // force la suppression des cookies (django)
    cookiePrefix: 'monlogementetudiant',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url)
    },
    password: {
      verify: async ({ hash, password }) => {
        // 1. Try scrypt (better-auth default) first
        const scryptMatch = await verifyScryptPassword({ hash, password }).catch(() => false)
        if (scryptMatch) return true

        // 2. If scrypt fails, try PBKDF2-SHA256 (Django format)
        if (hash.startsWith('pbkdf2_sha256$')) {
          const djangoMatch = verifyDjangoPassword(password, hash)
          if (djangoMatch) {
            // Rehash to scrypt — better-auth does NOT do this automatically
            const newHash = await hashPassword(password)
            await db
              .update(schema.account)
              .set({ password: newHash })
              .where(and(eq(schema.account.password, hash), eq(schema.account.providerId, 'credential')))
            return true
          }
        }

        return false
      },
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url)
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url)
      },
    }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      firstname: { type: 'string', defaultValue: '', input: true },
      lastname: { type: 'string', defaultValue: '', input: true },
      role: { type: 'string', defaultValue: 'user', input: false },
      legacyUser: { type: 'boolean', defaultValue: false, input: false },
      bailleurRole: { type: 'string', defaultValue: null, input: false },
      bailleurPermissions: { type: 'string[]', defaultValue: [], input: false },
    },
  },
})

export const getServerSession = cache(async () => {
  const requestHeaders = await headers()

  let results: Awaited<ReturnType<typeof auth.api.getSession>>
  try {
    results = await auth.api.getSession({
      headers: requestHeaders,
    })
  } catch (error) {
    // Safety net: better-auth may still attempt a cookie write in some edge cases
    // (expired session cleanup, forced invalidation) despite deferSessionRefresh: true.
    // Return null to let layouts redirect to login cleanly instead of crashing the page.
    if (error instanceof Error && error.message.includes('Cookies can only be modified')) {
      Sentry.captureMessage('auth: getServerSession cookie write blocked in Server Component', {
        level: 'warning',
        extra: { message: error.message },
      })
      return null
    }
    throw error
  }

  if (!results) return results

  const usr = await db.query.user.findFirst({
    where: eq(schema.user.id, results.user.id),
    with: { owner: true },
  })

  let adminOwners: Array<{ id: number; name: string; slug: string; url: string | null; acceptDossierFacileApplications: boolean }> = []

  if (usr?.role === 'admin') {
    const links = await db.query.adminOwnerLinks.findMany({
      where: eq(adminOwnerLinks.userId, results.user.id),
      with: { owner: true },
    })
    adminOwners = links.map((l) => ({
      id: l.owner.id,
      name: l.owner.name,
      slug: l.owner.slug,
      url: l.owner.url,
      acceptDossierFacileApplications: l.owner.acceptDossierFacileApplications,
    }))
  }

  return {
    ...results,
    user: {
      ...results.user,
      owner: usr?.owner ?? null,
      adminOwners,
      bailleurRole: usr?.bailleurRole ?? null,
      bailleurPermissions: usr?.bailleurPermissions ?? [],
    },
  }
})
