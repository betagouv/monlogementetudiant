import { apiKey } from '@better-auth/api-key'
import * as Sentry from '@sentry/nextjs'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { createAuthMiddleware } from 'better-auth/api'
import { nextCookies } from 'better-auth/next-js'
import { admin, emailOTP, magicLink } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'
import type { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { LOGIN_OTP_ALLOWED_ATTEMPTS, LOGIN_OTP_LENGTH } from '~/lib/login-otp'
import { canAccessOwnerSpace } from '~/lib/roles'
import { linkGuestContactRequestsSafely } from '~/server/contacts/link-guest-requests'
import { getClientIp, hashIp } from '~/server/contacts/rate-limit'
import { db } from '~/server/db'
import * as schema from '~/server/db/schema'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { env } from '~/server/env'
import { sendMagicLinkEmail, sendResetPasswordEmail, sendVerificationEmail } from '~/server/services/brevo'
import {
  findPendingMagicLinks,
  MAGIC_LINK_EXPIRES_IN_SECONDS,
  recordMagicLinkSent,
  recordMagicLinkSession,
  recordOtpSignIn,
  revokeSessionsFromConsumedLinks,
} from '~/server/services/login-attempts'
import { bindLoginRequestToBrowser, LOGIN_BINDING_COOKIE } from '~/server/services/login-binding'
import { createLoginOtp } from '~/server/services/login-otp'
import { syncStudentBrevoContactOnSignup } from '~/server/student/sync-brevo-contact'

export const oneDay = 24 * 60 * 60

const shouldLogAuthLinks = env.NEXT_PUBLIC_APP_ENV === 'development' && ['localhost', '127.0.0.1'].includes(new URL(env.BASE_URL).hostname)

function logLocalAuthLink(kind: 'activation' | 'connexion' | 'code' | 'reset-password', email: string, url: string) {
  if (!shouldLogAuthLinks) return
  console.log(`[better-auth:${kind}] ${email} -> ${url}`)
}

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.BASE_URL,
  trustedOrigins: [env.BASE_URL, ...(env.NEXT_PUBLIC_APP_ENV === 'development' ? ['http://localhost:3000'] : [])],
  // Routes HTTP sans usage côté client : les clés d'API et les comptes se gèrent depuis le back-office
  // (tRPC ou `auth.api.*`, non concernés par ce filtre).
  disabledPaths: [
    '/api-key/create',
    '/api-key/get',
    '/api-key/list',
    '/api-key/update',
    '/api-key/delete',
    '/admin/ban-user',
    '/admin/create-user',
    '/admin/get-user',
    '/admin/has-permission',
    '/admin/list-user-sessions',
    '/admin/list-users',
    '/admin/remove-user',
    '/admin/revoke-user-session',
    '/admin/revoke-user-sessions',
    '/admin/set-role',
    '/admin/set-user-password',
    '/admin/unban-user',
    '/admin/update-user',
    '/verify-password',
    // Le code de connexion n'est émis qu'avec le lien magique : seule la connexion par code reste exposée.
    '/email-otp/send-verification-otp',
    '/email-otp/check-verification-otp',
    '/email-otp/verify-email',
    '/forget-password/email-otp',
    '/email-otp/request-password-reset',
    '/email-otp/reset-password',
    '/email-otp/request-email-change',
    '/email-otp/change-email',
  ],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  session: {
    expiresIn: oneDay,
    updateAge: oneDay,
    deferSessionRefresh: true,
  },
  // Jetons de `verification` stockés hachés.
  verification: { storeIdentifier: 'hashed' },
  advanced: {
    cookiePrefix: 'monlogementetudiant',
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Bailleurs et admins se connectent uniquement par lien : pas de réinitialisation de mot de passe.
      // La réponse HTTP est identique dans tous les cas.
      const account = await db.query.user.findFirst({ where: eq(schema.user.id, user.id), columns: { role: true } })
      if (account?.role !== 'user') return
      logLocalAuthLink('reset-password', user.email, url)
      await sendResetPasswordEmail(user.email, url)
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
      storeToken: 'hashed',
      disableSignUp: true,
      sendMagicLink: async ({ email, url, token }, ctx) => {
        const usr = await db.query.user.findFirst({
          where: eq(schema.user.email, email),
          columns: { role: true },
        })
        // Liens de connexion réservés aux bailleurs et admins : jamais aux étudiants ni à un rôle inattendu.
        if (!canAccessOwnerSpace(usr?.role)) return
        // On n'envoie pas le lien de vérification Better Auth directement : les scanners
        // de mail d'entreprise (Safe Links, Proofpoint…) pré-ouvrent les liens en GET et
        // brûleraient le token à usage unique. On passe par une page tampon qui ne
        // déclenche la vérification qu'en JavaScript (voir /connexion/verification).
        // Si un scanner l'a tout de même consommé, la page reconnaît le navigateur à l'origine
        // de la demande grâce au cookie de liaison, et demande sinon le code envoyé avec le lien.
        const buffer = new URL('/connexion/verification', env.BASE_URL)
        buffer.searchParams.set('url', url)
        const otp = await createLoginOtp(email)
        const bindingHash = await bindLoginRequestToBrowser()
        logLocalAuthLink('connexion', email, buffer.toString())
        logLocalAuthLink('code', email, otp)
        await sendMagicLinkEmail(email, buffer.toString(), otp)
        // Suivi du parcours de connexion (espace administration > Connexions). Enregistré après
        // l'envoi : la table décrit les liens réellement partis, pas les demandes ignorées.
        await recordMagicLinkSent({ email, token, bindingHash, ipHash: hashIp(getClientIp(ctx)) })
      },
    }),
    emailOTP({
      otpLength: LOGIN_OTP_LENGTH,
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      allowedAttempts: LOGIN_OTP_ALLOWED_ATTEMPTS,
      storeOTP: 'hashed',
      disableSignUp: true,
      sendVerificationOTP: async () => {
        // Le code part uniquement dans l'email du lien magique (voir `sendMagicLink`).
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
    admin({
      impersonationSessionDuration: 60 * 60,
    }),
    nextCookies(),
  ],
  hooks: {
    // Le code survit à la consommation du lien : c'est le recours quand un scanner de mails l'a ouvert
    // avant le gestionnaire. Une connexion par code invalide les liens en attente et ferme les sessions
    // ouvertes par les liens déjà consommés.
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession
      if (!newSession) return

      if (ctx.path === '/magic-link/verify') {
        const token = typeof ctx.query?.token === 'string' ? ctx.query.token : null
        if (token) await recordMagicLinkSession({ token, sessionId: newSession.session.id })
        return
      }

      if (ctx.path !== '/sign-in/email-otp') return
      const email = newSession.user.email

      ctx.setCookie(LOGIN_BINDING_COOKIE, '', { path: '/', maxAge: 0 })
      const pendingLinks = await findPendingMagicLinks(email)
      for (const link of pendingLinks) {
        await ctx.context.internalAdapter.deleteVerificationByIdentifier(link.verificationIdentifier)
      }
      if (pendingLinks[0]) {
        await recordOtpSignIn({ attemptId: pendingLinks[0].id, userAgent: ctx.headers?.get('user-agent') ?? null })
      }
      await revokeSessionsFromConsumedLinks(email)
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await syncStudentBrevoContactOnSignup(createdUser)
        },
      },
    },
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
