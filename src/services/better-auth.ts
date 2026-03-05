import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { verifyPassword as verifyScryptPassword } from 'better-auth/crypto'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins'
import { headers } from 'next/headers'
import { cache } from 'react'
import { verifyDjangoPassword } from '~/lib/django-password'
import { db } from '~/server/db'
import * as schema from '~/server/db/schema'
import { sendMagicLinkEmail, sendResetPasswordEmail, sendVerificationEmail } from '~/server/services/brevo'

export const oneDay = 24 * 60 * 60

export const auth = betterAuth({
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BASE_URL,
  trustedOrigins: [process.env.BASE_URL!, 'http://localhost:3000'],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  session: {
    expiresIn: oneDay,
    updateAge: oneDay,
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
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
            // 3. Re-hash in scrypt will happen automatically —
            // better-auth calls hash() after verify() returns true
            // and updates account.password if the hash changed.
            // We return true so better-auth proceeds with re-hashing.
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
    },
  },
})

export const getServerSession = cache(async () => {
  const requestHeaders = await headers()

  const results = await auth.api.getSession({
    headers: requestHeaders,
  })

  return results
})
