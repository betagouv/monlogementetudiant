import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { getServerSession } from '~/services/better-auth'

export async function GET() {
  const session = await getServerSession()
  if (!session || session.user.role !== 'admin') {
    return new Response('Unauthorized', { status: 401 })
  }

  const rows = await db
    .select({
      prenom: user.firstname,
      nom: user.lastname,
      email: user.email,
      nom_gestionnaire: owners.name,
    })
    .from(user)
    .innerJoin(owners, eq(owners.id, user.ownerId))
    .where(inArray(user.role, ['user', 'owner']))
    .orderBy(owners.name, user.lastname, user.firstname)

  const headers = ['prenom', 'nom', 'email', 'nom_gestionnaire'] as const
  const lines = [headers.join(';'), ...rows.map((r) => headers.map((h) => r[h] ?? '').join(';'))]
  // BOM so Excel reads UTF-8 accents correctly
  const csv = `﻿${lines.join('\n')}`
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptes-gestionnaires-${date}.csv"`,
    },
  })
}
