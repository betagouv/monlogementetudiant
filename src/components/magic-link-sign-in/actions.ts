'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '~/server/db'
import { user } from '~/server/db/schema'
import { auth } from '~/services/better-auth'

export async function sendAdminMagicLink(email: string, callbackURL?: string) {
  const result = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.email, email), eq(user.role, 'admin')))
    .limit(1)

  if (result.length > 0) {
    const requestHeaders = await headers()
    await auth.api.signInMagicLink({ body: { email, callbackURL }, headers: requestHeaders })
  }

  return { success: true }
}
