import { apiKey } from '@better-auth/api-key'
import * as Sentry from '@sentry/nextjs'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { hashPassword, verifyPassword as verifyScryptPassword } from 'better-auth/crypto'
import { nextCookies } from 'better-auth/next-js'
import { magicLink } from 'better-auth/plugins'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { verifyDjangoPassword } from '~/lib/django-password'
import { linkGuestContactRequestsSafely } from '~/server/contacts/link-guest-requests'
import { db } from '~/server/db'
import * as schema from '~/server/db/schema'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { env } from '~/server/env'
import { sendMagicLinkEmail, sendResetPasswordEmail, sendVerificationEmail } from '~/server/services/brevo'
import { MAGIC_LINK_EXPIRES_IN_SECONDS, recordMagicLinkSent } from '~/server/services/login-attempts'

export const oneDay = 24 * 60 * 60

const shouldLogAuthLinks = env.NEXT_PUBLIC_APP_ENV === 'development' && ['localhost', '127.0.0.1'].includes(new URL(env.BASE_URL).hostname)

function logLocalAuthLink(kind: 'activation' | 'connexion' | 'reset-password', email: string, url: string) {
  if (!shouldLogAuthLinks) return
  console.log(`[better-auth:${kind}] ${email} -> ${url}`)
}

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
      logLocalAuthLink('reset-password', user.email, url)
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
      logLocalAuthLink('activation', user.email, url)
      await sendVerificationEmail(user.email, url)
    },
    sendOnSignUp: true,
    // Ne pas connecter automatiquement après activation : l'étudiant atterrit sur
    // la page de connexion (réassurance) et se connecte avec le mot de passe créé.
    autoSignInAfterVerification: false,
    // L'adresse vient d'être prouvée : on peut rattacher au compte les demandes de contact
    // laissées en visiteur avec cette même adresse.
    afterEmailVerification: async (user) => {
      await linkGuestContactRequestsSafely(user.id, user.email)
    },
  },
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      sendMagicLink: async ({ email, url, token }) => {
        const usr = await db.query.user.findFirst({
          where: eq(schema.user.email, email),
          columns: { role: true },
        })
        // Only send magic links to owners and admins, never to students (role 'user')
        if (!usr || usr.role === 'user') return
        // On n'envoie pas le lien de vérification Better Auth directement : les scanners
        // de mail d'entreprise (Safe Links, Proofpoint…) pré-ouvrent les liens en GET et
        // brûleraient le token à usage unique. On passe par une page tampon qui ne
        // déclenche la vérification qu'en JavaScript (voir /connexion/verification).
        const buffer = new URL('/connexion/verification', env.BASE_URL)
        buffer.searchParams.set('url', url)
        logLocalAuthLink('connexion', email, buffer.toString())
        await sendMagicLinkEmail(email, buffer.toString())
        // Suivi du parcours de connexion (espace administration > Connexions). Enregistré après
        // l'envoi : la table décrit les liens réellement partis, pas les demandes ignorées.
        await recordMagicLinkSent({ email, token })
      },
    }),
    // Clés d'API pour l'API publique v1 : attribution du trafic + rate-limit par clé (stocké en PG).
    // La vérification (`auth.api.verifyApiKey`) incrémente `requestCount` et applique le rate-limit.
    apiKey({
      apiKeyHeaders: 'x-api-key',
      enableMetadata: true,
      rateLimit: {
        enabled: true,
        timeWindow: env.API_V1_RATE_LIMIT_WINDOW_MS,
        maxRequests: env.API_V1_RATE_LIMIT_MAX,
      },
    }),
    nextCookies(),
  ],
  databaseHooks: {
    session: {
      create: {
        // Filet de sécurité : couvre l'étudiant qui avait déjà un compte et a laissé ses coordonnées
        // en étant déconnecté (le hook de vérification d'e-mail, lui, ne joue qu'à l'inscription).
        after: async (createdSession) => {
          const usr = await db.query.user.findFirst({
            where: eq(schema.user.id, createdSession.userId),
            columns: { email: true, emailVerified: true, role: true },
          })
          if (!usr?.emailVerified || usr.role !== 'user') return
          await linkGuestContactRequestsSafely(createdSession.userId, usr.email)
        },
      },
    },
  },
  user: {
    additionalFields: {
      firstname: { type: 'string', defaultValue: '', input: true },
      lastname: { type: 'string', defaultValue: '', input: true },
      phone: { type: 'string', defaultValue: null, input: true },
      birthdate: { type: 'string', defaultValue: null, input: true },
      scholarshipStatus: { type: 'string', defaultValue: null, input: true },
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

  let adminOwners: Array<{ id: number; name: string; slug: string; url: string | null; contactMode: EOwnerContactMode }> = []

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
      contactMode: l.owner.contactMode,
    }))
  }

  return {
    ...results,
    user: {
      ...results.user,
      role: usr?.role ?? results.user.role,
      owner: usr?.owner ?? null,
      adminOwners,
      bailleurRole: usr?.bailleurRole ?? null,
      bailleurPermissions: usr?.bailleurPermissions ?? [],
    },
  }
})
