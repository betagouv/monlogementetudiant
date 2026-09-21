import { and, asc, eq, ne } from 'drizzle-orm'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { bailleurAccommodationScopes } from '~/server/db/schema/bailleur-accommodation-scopes'
import { env } from '~/server/env'
import { sendApplicationsManagementGrantedEmail, sendApplicationsSuspendedEmail } from '~/server/services/brevo'

export type ManagedResidences = { mode: 'all' | 'restricted'; residences: Array<{ id: number; name: string }> }

type OwnerRef = { id: number; name: string }

/** Résidences dont le gestionnaire traite les candidatures ; `null` s'il n'en traite aucune. */
export async function readManagedResidences(userId: string): Promise<ManagedResidences | null> {
  const target = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true, ownerId: true, bailleurRole: true, bailleurPermissions: true, applicationScopeRestricted: true },
  })
  if (!target?.ownerId || target.role !== 'owner' || target.bailleurRole !== 'gestionnaire') return null
  if (!target.bailleurPermissions.includes('manage_applications')) return null

  if (!target.applicationScopeRestricted) {
    const residences = await db
      .select({ id: accommodations.id, name: accommodations.name })
      .from(accommodations)
      .where(and(eq(accommodations.ownerId, target.ownerId), eq(accommodations.acceptsApplications, true)))
      .orderBy(asc(accommodations.name))
    return { mode: 'all', residences }
  }

  const residences = await db
    .select({ id: accommodations.id, name: accommodations.name })
    .from(bailleurAccommodationScopes)
    .innerJoin(accommodations, eq(accommodations.id, bailleurAccommodationScopes.accommodationId))
    .where(and(eq(bailleurAccommodationScopes.userId, userId), eq(accommodations.ownerId, target.ownerId)))
    .orderBy(asc(accommodations.name))
  return { mode: 'restricted', residences }
}

export async function notifyApplicationsManagementGranted({
  userId,
  before,
  owner,
}: {
  userId: string
  before: ManagedResidences | null
  owner: OwnerRef
}) {
  try {
    const after = await readManagedResidences(userId)
    if (!after) return

    const known = new Set(before?.residences.map((r) => r.id))
    const added = after.residences.filter((r) => !known.has(r.id))
    const becameAll = after.mode === 'all' && before?.mode !== 'all'
    if (!becameAll && added.length === 0) return

    const target = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { email: true, firstname: true } })
    if (!target) return

    await sendApplicationsManagementGrantedEmail(target.email, {
      firstname: target.firstname,
      ownerName: owner.name,
      residences: becameAll ? [`Toutes les résidences de ${owner.name}`] : added.map((r) => r.name),
      residencesCount: becameAll ? after.residences.length : added.length,
      url: `${env.BASE_URL}/bailleur/contacts`,
    })
  } catch (err) {
    console.error('Erreur envoi email attribution gestion des candidatures', err)
  }
}

export async function notifyApplicationsSuspended({
  accommodation,
  actor,
  owner,
  suspendedAt,
}: {
  accommodation: { name: string; slug: string }
  actor: { id: string; name: string }
  owner: OwnerRef
  suspendedAt: Date
}) {
  try {
    const administrators = await db.query.user.findMany({
      where: and(
        eq(user.ownerId, owner.id),
        eq(user.role, 'owner'),
        eq(user.bailleurRole, 'administrator'),
        eq(user.banned, false),
        ne(user.id, actor.id),
      ),
      columns: { email: true, firstname: true },
    })

    const results = await Promise.allSettled(
      administrators.map((admin) =>
        sendApplicationsSuspendedEmail(admin.email, {
          firstname: admin.firstname,
          residenceName: accommodation.name,
          suspendedBy: actor.name,
          ownerName: owner.name,
          suspendedAt: suspendedAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }),
          url: `${env.BASE_URL}/bailleur/contacts/${accommodation.slug}`,
        }),
      ),
    )
    for (const result of results) {
      if (result.status === 'rejected') console.error('Erreur envoi email suspension des candidatures', result.reason)
    }
  } catch (err) {
    console.error('Erreur envoi email suspension des candidatures', err)
  }
}
