import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { activityLog } from '../server/db/schema/activity-log'
import { createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, gestionnaireCallerFactory } from './helpers/test-caller'

const CONTACT_MODE_ACTION = 'owner.contact_mode_updated'

type ContactModeDiff = { diff: { contactMode: { old: string | null; new: string } } }

const readContactModeLogs = async (ownerId: number) => {
  const db = getTestDb()
  return db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.ownerId, ownerId), eq(activityLog.action, CONTACT_MODE_ACTION)))
    .orderBy(activityLog.id)
}

beforeEach(async () => {
  // `activity_log` n'est pas tronquée par `cleanTables` (elle survit volontairement aux entités
  // qu'elle décrit) alors que les identifiants d'`owner` repartent de 1 : sans purge explicite,
  // les entrées d'un test précédent seraient relues sous le même `ownerId`.
  await getTestDb().delete(activityLog)
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
  await createUser({ id: 'test-gestionnaire-id', name: 'Gestionnaire', email: 'gestionnaire@test.com', role: 'owner' })
})

describe('journal du mode de réception des candidatures', () => {
  it('trace le choix fait en self-service par le gestionnaire', async () => {
    const owner = await createOwner({ name: 'Bailleur Mode', slug: 'bailleur-mode', userId: 'test-gestionnaire-id' })
    const permCaller = gestionnaireCallerFactory({ permissions: ['manage_applications'] })

    await permCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })

    const [entry, ...rest] = await readContactModeLogs(owner.id)
    expect(rest).toHaveLength(0)
    expect(entry.userId).toBe('test-gestionnaire-id')
    expect(entry.entityType).toBe('owner')
    expect(entry.entityName).toBe('Bailleur Mode')
    expect(entry.ownerName).toBe('Bailleur Mode')
    expect((entry.metadata as ContactModeDiff).diff.contactMode).toEqual({
      old: EOwnerContactMode.NONE,
      new: EOwnerContactMode.CONTACTS,
    })
  })

  it('trace le passage de coordonnées à DossierFacile', async () => {
    const owner = await createOwner({
      name: 'Bailleur DF',
      slug: 'bailleur-df',
      userId: 'test-gestionnaire-id',
      contactMode: EOwnerContactMode.CONTACTS,
    })
    const permCaller = gestionnaireCallerFactory({ permissions: ['manage_applications'] })

    await permCaller.bailleur.setContactMode({ mode: EOwnerContactMode.DOSSIER_FACILE })

    const [entry] = await readContactModeLogs(owner.id)
    expect((entry.metadata as ContactModeDiff).diff.contactMode).toEqual({
      old: EOwnerContactMode.CONTACTS,
      new: EOwnerContactMode.DOSSIER_FACILE,
    })
  })

  it('ne journalise rien quand le mode est réenregistré à l’identique', async () => {
    const owner = await createOwner({
      name: 'Bailleur Idem',
      slug: 'bailleur-idem',
      userId: 'test-gestionnaire-id',
      contactMode: EOwnerContactMode.CONTACTS,
    })
    const permCaller = gestionnaireCallerFactory({ permissions: ['manage_applications'] })

    await permCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })

    expect(await readContactModeLogs(owner.id)).toHaveLength(0)
  })

  it('trace le mode changé depuis l’espace administration', async () => {
    const owner = await createOwner({ name: 'Bailleur Admin', slug: 'bailleur-admin' })

    await adminCaller.admin.owners.update({ id: owner.id, contactMode: EOwnerContactMode.DOSSIER_FACILE })

    const [entry] = await readContactModeLogs(owner.id)
    expect(entry.userId).toBe('test-admin-id')
    expect(entry.userName).toBe('Test Admin')
    expect((entry.metadata as ContactModeDiff).diff.contactMode).toEqual({
      old: EOwnerContactMode.NONE,
      new: EOwnerContactMode.DOSSIER_FACILE,
    })
  })

  it('ne journalise pas une modification de fiche qui ne touche pas au mode', async () => {
    const owner = await createOwner({ name: 'Bailleur Renommé', slug: 'bailleur-renomme' })

    await adminCaller.admin.owners.update({ id: owner.id, name: 'Bailleur Renommé bis' })

    expect(await readContactModeLogs(owner.id)).toHaveLength(0)
  })
})

describe('admin.owners.list — suivi des modes', () => {
  it('expose le mode de chaque gestionnaire et la répartition globale', async () => {
    await createOwner({ name: 'Alpha DF', slug: 'alpha-df', contactMode: EOwnerContactMode.DOSSIER_FACILE })
    await createOwner({ name: 'Beta Coordonnées', slug: 'beta-coord', contactMode: EOwnerContactMode.CONTACTS })
    await createOwner({ name: 'Gamma Rien', slug: 'gamma-rien' })

    const result = await adminCaller.admin.owners.list({ page: 1 })

    expect(result.items.map((item) => [item.name, item.contactMode])).toEqual([
      ['Alpha DF', EOwnerContactMode.DOSSIER_FACILE],
      ['Beta Coordonnées', EOwnerContactMode.CONTACTS],
      ['Gamma Rien', EOwnerContactMode.NONE],
    ])
    expect(result.contactModeCounts).toEqual({
      [EOwnerContactMode.DOSSIER_FACILE]: 1,
      [EOwnerContactMode.CONTACTS]: 1,
      [EOwnerContactMode.NONE]: 1,
    })
  })

  it('filtre sur un mode sans fausser la répartition affichée', async () => {
    await createOwner({ name: 'Alpha DF', slug: 'alpha-df', contactMode: EOwnerContactMode.DOSSIER_FACILE })
    await createOwner({ name: 'Beta Coordonnées', slug: 'beta-coord', contactMode: EOwnerContactMode.CONTACTS })
    await createOwner({ name: 'Gamma Rien', slug: 'gamma-rien' })

    const result = await adminCaller.admin.owners.list({ page: 1, contactMode: EOwnerContactMode.DOSSIER_FACILE })

    expect(result.total).toBe(1)
    expect(result.items.map((item) => item.name)).toEqual(['Alpha DF'])
    expect(result.contactModeCounts[EOwnerContactMode.NONE]).toBe(1)
  })
})
