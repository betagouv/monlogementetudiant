import { and, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { cache } from 'react'
import { findVisibleApplicationForTenant } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import { accommodations } from '~/server/db/schema/accommodations'
import { user } from '~/server/db/schema/auth'
import { bailleurAccommodationScopes } from '~/server/db/schema/bailleur-accommodation-scopes'
import { dossierFacileApplications } from '~/server/db/schema/dossier-facile'

export type AccommodationScope = { kind: 'all' } | { kind: 'restricted'; accommodationIds: number[]; accommodationSlugs: string[] }

const ALL: AccommodationScope = { kind: 'all' }

export const getAccommodationScope = cache(async (userId: string): Promise<AccommodationScope> => {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true, bailleurRole: true, ownerId: true, applicationScopeRestricted: true },
  })

  if (!usr || usr.role === 'admin' || usr.bailleurRole !== 'gestionnaire') return ALL
  if (!usr.applicationScopeRestricted || !usr.ownerId) return ALL

  const rows = await db
    .select({ id: accommodations.id, slug: accommodations.slug })
    .from(bailleurAccommodationScopes)
    .innerJoin(accommodations, eq(accommodations.id, bailleurAccommodationScopes.accommodationId))
    .where(and(eq(bailleurAccommodationScopes.userId, userId), eq(accommodations.ownerId, usr.ownerId)))

  return {
    kind: 'restricted',
    accommodationIds: rows.map((r) => r.id),
    accommodationSlugs: rows.map((r) => r.slug),
  }
})

export const scopeAccommodationIdCondition = (scope: AccommodationScope): SQL | undefined =>
  scope.kind === 'all' ? undefined : inArray(accommodations.id, scope.accommodationIds)

export const scopeApplicationSlugCondition = (scope: AccommodationScope): SQL | undefined =>
  scope.kind === 'all' ? undefined : inArray(dossierFacileApplications.accommodationSlug, scope.accommodationSlugs)

export const scopeAllowsAccommodationId = (scope: AccommodationScope, accommodationId: number): boolean =>
  scope.kind === 'all' || scope.accommodationIds.includes(accommodationId)

export const scopeHasAnyAccommodation = (scope: AccommodationScope): boolean => scope.kind === 'all' || scope.accommodationIds.length > 0

/**
 * Candidatures du bailleur de l'appelant. Un locataire peut candidater chez plusieurs bailleurs : sans ce
 * filtre, la recherche (non ordonnée) pouvait tomber sur la candidature d'un autre bailleur et refuser
 * l'accès au dossier de façon aléatoire. L'admin plateforme n'est pas restreint (cf. `checkAccommodationAccess`).
 */
const ownerApplicationCondition = async (userId: string): Promise<SQL | undefined> => {
  const usr = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { role: true, ownerId: true } })
  if (usr?.role === 'admin') return undefined
  if (!usr?.ownerId) return sql`false`
  return inArray(
    dossierFacileApplications.accommodationSlug,
    db.select({ slug: accommodations.slug }).from(accommodations).where(eq(accommodations.ownerId, usr.ownerId)),
  )
}

export const findScopedApplicationForTenant = async (userId: string, tenantId: string) =>
  findVisibleApplicationForTenant(
    tenantId,
    and(scopeApplicationSlugCondition(await getAccommodationScope(userId)), await ownerApplicationCondition(userId)),
  )
