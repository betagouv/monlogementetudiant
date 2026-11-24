import { hashPassword } from 'better-auth/crypto'
import { account } from '../../server/db/schema/auth'
import { createUser } from '../fixtures/factories'
import { getTestDb } from '../helpers/test-db'

/** Mot de passe commun à tous les comptes créés par le seed et par les tests e2e. */
export const SEED_PASSWORD = 'Mot-de-passe-e2e-123'

/** Utilisateur avec un compte « credential » (connexion e-mail + mot de passe {@link SEED_PASSWORD}). */
export async function createCredentialUser(fields: Parameters<typeof createUser>[0]) {
  const row = await createUser(fields)
  await getTestDb()
    .insert(account)
    .values({
      id: `account-${row.id}`,
      userId: row.id,
      accountId: row.id,
      providerId: 'credential',
      password: await hashPassword(SEED_PASSWORD),
    })
  return row
}
