import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOwner, createUser } from '../../../src/__tests__/fixtures/factories'
import { getTestDb } from '../../../src/__tests__/helpers/test-db'
import { EOwnerContactMode } from '../../../src/enums/owner-contact-mode'
import { user } from '../../../src/server/db/schema/auth'
import { owners } from '../../../src/server/db/schema/owners'

const { demoteBailleurAdmins } = await import('../demote-bailleur-admins')

const db = getTestDb()
const tmpFiles: string[] = []
const noop = () => undefined

/** Ecrit un CSV temporaire hors du depot, comme le fichier reel passe par --file. */
function writeCsv(rows: string[]): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'demote-')), 'comptes.csv')
  fs.writeFileSync(file, ['prenom,nom,email,nom_gestionnaire,admin', ...rows].join('\n'), 'utf-8')
  tmpFiles.push(file)
  return file
}

async function readUser(id: string) {
  return db.query.user.findFirst({ where: eq(user.id, id) })
}

let ownerId: number

beforeEach(async () => {
  // La commande est bavarde par construction : on tait sa sortie pour garder le rapport de test lisible.
  vi.spyOn(console, 'log').mockImplementation(noop)
  vi.spyOn(console, 'error').mockImplementation(noop)

  await createUser({ id: 'boss', name: 'Boss', email: 'boss@bailleur.fr', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur CLI', slug: 'bailleur-cli', userId: 'boss' })
  ownerId = owner.id
  await db.update(user).set({ bailleurRole: 'administrator' }).where(eq(user.id, 'boss'))

  for (const id of ['membre-1', 'membre-2']) {
    await createUser({ id, name: id, email: `${id}@bailleur.fr`, role: 'owner' })
    await db.update(user).set({ ownerId, bailleurRole: 'administrator' }).where(eq(user.id, id))
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  for (const file of tmpFiles.splice(0)) fs.rmSync(path.dirname(file), { recursive: true, force: true })
})

describe('demote-bailleur-admins', () => {
  it('demotes only the rows whose admin column is empty', async () => {
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,oui',
    ])

    await demoteBailleurAdmins({ file, dryRun: false })

    expect((await readUser('membre-1'))?.bailleurRole).toBe('gestionnaire')
    expect((await readUser('membre-2'))?.bailleurRole).toBe('administrator')
    expect((await readUser('boss'))?.bailleurRole).toBe('administrator')
  })

  it('sets only manage_residences when the bailleur has no application journey', async () => {
    const file = writeCsv(['B,Oss,boss@bailleur.fr,Bailleur CLI,oui', 'M,Un,membre-1@bailleur.fr,Bailleur CLI,'])

    await demoteBailleurAdmins({ file, dryRun: false })

    const membre = await readUser('membre-1')
    expect([...(membre?.bailleurPermissions ?? [])].sort()).toEqual(['manage_residences'])
  })

  it('adds manage_applications once the bailleur has chosen an application journey', async () => {
    await db.update(owners).set({ contactMode: EOwnerContactMode.CONTACTS }).where(eq(owners.id, ownerId))
    const file = writeCsv(['B,Oss,boss@bailleur.fr,Bailleur CLI,oui', 'M,Un,membre-1@bailleur.fr,Bailleur CLI,'])

    await demoteBailleurAdmins({ file, dryRun: false })

    const membre = await readUser('membre-1')
    expect([...(membre?.bailleurPermissions ?? [])].sort()).toEqual(['manage_applications', 'manage_residences'])
  })

  it('writes nothing in dry-run mode', async () => {
    const file = writeCsv(['B,Oss,boss@bailleur.fr,Bailleur CLI,oui', 'M,Un,membre-1@bailleur.fr,Bailleur CLI,'])

    await demoteBailleurAdmins({ file, dryRun: true })

    expect((await readUser('membre-1'))?.bailleurRole).toBe('administrator')
  })

  it('aborts without writing when a bailleur would end with zero administrators', async () => {
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await expect(demoteBailleurAdmins({ file, dryRun: false })).rejects.toThrow(/sans administrateur|Abandon/)

    expect((await readUser('boss'))?.bailleurRole).toBe('administrator')
    expect((await readUser('membre-1'))?.bailleurRole).toBe('administrator')
  })

  it('proceeds despite a zero-administrator bailleur when --allow-no-admin is set', async () => {
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false, allowNoAdmin: true })

    const rows = await db
      .select()
      .from(user)
      .where(inArray(user.id, ['boss', 'membre-1', 'membre-2']))
    expect(rows.every((r) => r.bailleurRole === 'gestionnaire')).toBe(true)
  })

  it('deduplicates an email appearing twice in the CSV', async () => {
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Un,membre-1@bailleur.fr,Autre Bailleur,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false })

    expect((await readUser('membre-1'))?.bailleurRole).toBe('gestionnaire')
  })

  it('matches emails case-insensitively and trimmed', async () => {
    const file = writeCsv(['B,Oss,boss@bailleur.fr,Bailleur CLI,oui', 'M,Un,  MEMBRE-1@BAILLEUR.FR ,Bailleur CLI,'])

    await demoteBailleurAdmins({ file, dryRun: false })

    expect((await readUser('membre-1'))?.bailleurRole).toBe('gestionnaire')
  })

  it('reports emails absent from the database and non-owner accounts without failing', async () => {
    await createUser({ id: 'etudiant', name: 'Etudiant', email: 'etudiant@test.fr', role: 'user' })
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'I,Nconnu,inconnu@nulle-part.fr,Bailleur CLI,',
      'E,Tudiant,etudiant@test.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false })

    expect((await readUser('membre-1'))?.bailleurRole).toBe('gestionnaire')
    expect((await readUser('etudiant'))?.bailleurRole).toBeNull()
  })

  it('reports an administrator-to-keep that is missing from the database', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })

    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'F,Antome,fantome@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: true })

    expect(logs.join('\n')).toContain('administrateur(s) attendu(s) absent(s) de la base')
    expect(logs.join('\n')).toContain('fantome@bailleur.fr')
  })

  it('still prints the reconciliation report when the safety net aborts', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })

    const file = writeCsv([
      'F,Antome,fantome@bailleur.fr,Bailleur CLI,oui',
      'B,Oss,boss@bailleur.fr,Bailleur CLI,',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await expect(demoteBailleurAdmins({ file, dryRun: false })).rejects.toThrow(/Abandon/)

    // Le rapport doit expliquer l'abandon : l'administrateur prevu n'existe pas en base.
    expect(logs.join('\n')).toContain('fantome@bailleur.fr')
  })

  it('reports a designated administrator who is only a gestionnaire in the database (--no-promote)', async () => {
    const logs: string[] = []
    vi.mocked(console.log).mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '))
    })

    // membre-2 est designe administrateur au CSV mais n'est que gestionnaire en base :
    // la commande ne promeut pas, elle doit donc le signaler.
    await db.update(user).set({ bailleurRole: 'gestionnaire' }).where(eq(user.id, 'membre-2'))
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: true, promote: false })

    expect(logs.join('\n')).toContain('attendu(s) administrateur mais pas administrateur en base')
    expect(logs.join('\n')).toContain('membre-2@bailleur.fr')
    // Et il reste gestionnaire : aucune promotion.
    expect((await readUser('membre-2'))?.bailleurRole).toBe('gestionnaire')
  })

  it('is idempotent when run twice', async () => {
    const file = writeCsv(['B,Oss,boss@bailleur.fr,Bailleur CLI,oui', 'M,Un,membre-1@bailleur.fr,Bailleur CLI,'])

    await demoteBailleurAdmins({ file, dryRun: false })
    const first = await readUser('membre-1')
    await demoteBailleurAdmins({ file, dryRun: false })
    const second = await readUser('membre-1')

    expect(second?.bailleurRole).toBe('gestionnaire')
    expect(second?.updatedAt).toEqual(first?.updatedAt)
  })

  it('promotes a designated administrator by default', async () => {
    await db
      .update(user)
      .set({ bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'membre-2'))
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false })

    const promu = await readUser('membre-2')
    expect(promu?.bailleurRole).toBe('administrator')
    // Invariant du routeur : un administrateur n'a pas de permissions explicites.
    expect(promu?.bailleurPermissions).toEqual([])
  })

  it('leaves designated administrators untouched with --no-promote', async () => {
    await db
      .update(user)
      .set({ bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })
      .where(eq(user.id, 'membre-2'))
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false, promote: false })

    const inchange = await readUser('membre-2')
    expect(inchange?.bailleurRole).toBe('gestionnaire')
    expect(inchange?.bailleurPermissions).toEqual(['manage_residences'])
  })

  it('aborts when promoting would push a bailleur past 2 administrators', async () => {
    // boss + membre-1 + membre-2 sont administrateurs ; on promeut un 4e compte.
    await createUser({ id: 'membre-3', name: 'M3', email: 'membre-3@bailleur.fr', role: 'owner' })
    await db.update(user).set({ ownerId, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'membre-3'))

    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,oui',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,oui',
      'M,Trois,membre-3@bailleur.fr,Bailleur CLI,oui',
    ])

    await expect(demoteBailleurAdmins({ file, dryRun: false })).rejects.toThrow(/au-dela de 2 administrateurs/)
    expect((await readUser('membre-3'))?.bailleurRole).toBe('gestionnaire')
  })

  it('does not block on the ceiling when only demoting', async () => {
    // Le bailleur a 3 administrateurs (au-dela du plafond) : une retrogradation seule doit passer.
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,oui',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false, promote: false })

    expect((await readUser('membre-2'))?.bailleurRole).toBe('gestionnaire')
  })

  it('promotion and demotion together keep the bailleur within the ceiling', async () => {
    await createUser({ id: 'membre-3', name: 'M3', email: 'membre-3@bailleur.fr', role: 'owner' })
    await db.update(user).set({ ownerId, bailleurRole: 'gestionnaire' }).where(eq(user.id, 'membre-3'))

    // boss et membre-3 deviennent/restent administrateurs, membre-1 et membre-2 sont retrogrades.
    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,oui',
      'M,Trois,membre-3@bailleur.fr,Bailleur CLI,oui',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await demoteBailleurAdmins({ file, dryRun: false })

    expect((await readUser('membre-3'))?.bailleurRole).toBe('administrator')
    expect((await readUser('membre-1'))?.bailleurRole).toBe('gestionnaire')
    expect((await readUser('membre-2'))?.bailleurRole).toBe('gestionnaire')
  })

  it('names the bailleur in the abort message even when it has no administrator left', async () => {
    const errors: string[] = []
    vi.mocked(console.error).mockImplementation((...args: unknown[]) => {
      errors.push(args.join(' '))
    })

    const file = writeCsv([
      'B,Oss,boss@bailleur.fr,Bailleur CLI,',
      'M,Un,membre-1@bailleur.fr,Bailleur CLI,',
      'M,Deux,membre-2@bailleur.fr,Bailleur CLI,',
    ])

    await expect(demoteBailleurAdmins({ file, dryRun: false })).rejects.toThrow(/Abandon/)

    expect(errors.join('\n')).toContain('Bailleur CLI')
  })

  it('refuses a CSV without the expected columns', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'demote-')), 'bad.csv')
    fs.writeFileSync(file, 'prenom,nom\nA,B\n', 'utf-8')
    tmpFiles.push(file)

    await expect(demoteBailleurAdmins({ file, dryRun: false })).rejects.toThrow(/Colonnes attendues/)
  })
})
