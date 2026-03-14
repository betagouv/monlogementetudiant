import { eq } from 'drizzle-orm'
import { generateSlug } from '~/server/trpc/utils/accommodation-helpers'
import { owners } from '../../src/server/db/schema'
import { db } from '../lib/db'

export async function getOrCreateOwner(name: string, url?: string): Promise<number> {
  const existing = await db.select().from(owners).where(eq(owners.name, name)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = generateSlug(name)

  const [created] = await db
    .insert(owners)
    .values({ name, slug, url: url || null })
    .returning({ id: owners.id })
  return created.id
}
