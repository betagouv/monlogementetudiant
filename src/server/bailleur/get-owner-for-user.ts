import { and, eq } from 'drizzle-orm'
import { db } from '~/server/db'
import { adminOwnerLinks } from '~/server/db/schema/admin-owner-links'
import { user } from '~/server/db/schema/auth'

export async function getOwnerForUser(userId: string, ownerId?: number) {
  const usr = await db.query.user.findFirst({
    where: eq(user.id, userId),
    with: { owner: true },
  })

  if (usr?.role === 'admin') {
    if (ownerId) {
      // Admin with specific bailleur: verify the admin is linked to this owner
      const link = await db.query.adminOwnerLinks.findFirst({
        where: and(eq(adminOwnerLinks.userId, userId), eq(adminOwnerLinks.ownerId, ownerId)),
        with: { owner: true },
      })
      if (link) return link.owner
    }

    // Admin without bailleur or invalid bailleur: use direct owner or first linked owner
    if (usr.owner) return usr.owner
    const firstLink = await db.query.adminOwnerLinks.findFirst({
      where: eq(adminOwnerLinks.userId, userId),
      with: { owner: true },
    })
    return firstLink?.owner ?? null
  }

  return usr?.owner ?? null
}
