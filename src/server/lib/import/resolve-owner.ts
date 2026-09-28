import { eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { owners } from '~/server/db/schema'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { findAvailableSlug } from '~/server/utils/slug'

export type ResolveImportOwnerInput = {
  id?: number | null
  slug?: string | null
  name?: string | null
  url?: string | null
}

/**
 * Résout le bailleur d'un import, par ordre de priorité : `id`, puis `slug`, puis `name`.
 *
 * `id` et `slug` sont des identifiants stables (le slug est UNIQUE et n'est jamais réécrit par
 * `admin.owners.update`) : s'ils ne correspondent à rien, on lève — pas de repli sur le nom, sinon on
 * recréerait le doublon que ce chemin sert justement à éviter. Le get-or-create par nom reste le
 * dernier recours : c'est le seul moyen d'amorcer un bailleur qui n'existe pas encore.
 */
export async function resolveImportOwner({ id, slug, name, url }: ResolveImportOwnerInput): Promise<{ id: number; name: string }> {
  if (id != null) {
    const [existing] = await db.select({ id: owners.id, name: owners.name }).from(owners).where(eq(owners.id, id)).limit(1)
    if (!existing) throw new Error(`Bailleur introuvable : id=${id}`)
    return existing
  }

  const trimmedSlug = slug?.trim()
  if (trimmedSlug) {
    const [existing] = await db.select({ id: owners.id, name: owners.name }).from(owners).where(eq(owners.slug, trimmedSlug)).limit(1)
    if (!existing) throw new Error(`Bailleur introuvable : slug=${trimmedSlug}`)
    return existing
  }

  const trimmedName = name?.trim()
  if (!trimmedName) throw new Error('Bailleur non identifié : renseignez un id, un slug ou un nom')

  const [existing] = await db.select({ id: owners.id, name: owners.name }).from(owners).where(eq(owners.name, trimmedName)).limit(1)
  if (existing) return existing

  const newSlug = await findAvailableSlug(generateSlug(trimmedName), db, owners)
  const [created] = await db
    .insert(owners)
    .values({ name: trimmedName, slug: newSlug, url: url?.trim() || null })
    .returning({ id: owners.id, name: owners.name })
  return created
}

/** Les disponibilités de ce bailleur arrivent par import : la règle de fraîcheur des dispos ne s'applique pas à lui. */
export async function markAvailabilityImported(ownerId: number): Promise<void> {
  await db.update(owners).set({ availabilityImported: true }).where(eq(owners.id, ownerId))
}
