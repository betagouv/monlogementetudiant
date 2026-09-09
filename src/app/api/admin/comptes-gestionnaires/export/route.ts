import { eq, inArray, sql } from 'drizzle-orm'
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
  role: string
}

const COLUMNS: TCsvColumn<TOwnerAccountCsvRow>[] = [
  { key: 'prenom', header: 'prenom' },
  { key: 'nom', header: 'nom' },
  { key: 'email', header: 'email' },
  { key: 'nom_gestionnaire', header: 'nom_gestionnaire' },
  { key: 'role', header: 'role' },
]

// Les administrateurs remontent en bloc en tete du fichier, les autres comptes ensuite ; chaque bloc
// est classe par nom de bailleur. Un CASE plutot qu'un `... DESC` sur le booleen : un `bailleur_role`
// nul rend la comparaison NULL, que Postgres placerait en tete du tri descendant.
const ADMINISTRATORS_FIRST = sql`case when ${user.bailleurRole} = 'administrator' then 0 else 1 end`

const ROLE_LABEL = sql<string>`case
  when ${user.bailleurRole} = 'administrator' then 'Administrateur'
  when ${user.bailleurRole} = 'gestionnaire' then 'Gestionnaire'
  else ''
end`

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
      role: ROLE_LABEL,
    })
    .from(user)
    .innerJoin(owners, eq(owners.id, user.ownerId))
    .where(inArray(user.role, ['user', 'owner']))
    .orderBy(ADMINISTRATORS_FIRST, owners.name, user.lastname, user.firstname)

  const csv = toCsv(COLUMNS, rows)
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="comptes-gestionnaires-${date}.csv"`,
    },
  })
}
