import { eq, inArray } from 'drizzle-orm'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { owners } from '~/server/db/schema/owners'
import { getServerSession } from '~/services/better-auth'
import { type TCsvColumn, toCsv } from '~/utils/csv'

type TOwnerAccountCsvRow = {
  prenom: string
  nom: string
  email: string
  nom_gestionnaire: string
}

const COLUMNS: TCsvColumn<TOwnerAccountCsvRow>[] = [
  { key: 'prenom', header: 'prenom' },
  { key: 'nom', header: 'nom' },
  { key: 'email', header: 'email' },
  { key: 'nom_gestionnaire', header: 'nom_gestionnaire' },
]

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

  const csv = toCsv(COLUMNS, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptes-gestionnaires-${date}.csv"`,
    },
  })
}
