import type { Column } from 'drizzle-orm'
import { desc, like, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * Find the first available slug for a given table.
 * If "my-slug" is taken, tries "my-slug-1", "my-slug-2", etc.
 */
export async function findAvailableSlug(
  baseSlug: string,
  // biome-ignore lint/suspicious/noExplicitAny: db instance varies between CLI and server
  database: PostgresJsDatabase<any>,
  table: PgTable & { slug: Column },
): Promise<string> {
  const slugCol = table.slug

  const existing = await database
    .select({ slug: slugCol })
    .from(table)
    .where(like(slugCol, `${baseSlug}%`))
    .orderBy(desc(sql`length(${slugCol})`), desc(slugCol))

  if (existing.length === 0) return baseSlug

  const taken = new Set(existing.map((r) => r.slug as string))
  if (!taken.has(baseSlug)) return baseSlug

  const prefix = `${baseSlug}-`
  let max = 0
  for (const { slug } of existing) {
    const s = slug as string
    if (s.startsWith(prefix)) {
      const suffix = s.slice(prefix.length)
      const num = Number.parseInt(suffix, 10)
      if (!Number.isNaN(num) && num > max) max = num
    }
  }

  return `${prefix}${max + 1}`
}
