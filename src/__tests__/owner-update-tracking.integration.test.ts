import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { user } from '../server/db/schema/auth'
import { owners } from '../server/db/schema/owners'
import { typologyDraft } from '../server/lib/typologies'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'
import { adminCaller, ownerCaller } from './helpers/test-caller'

type AccommodationOverrides = NonNullable<Parameters<typeof createAccommodation>[0]>
const parisPoint = { type: 'Point', coordinates: [2.3522, 48.8566] } as NonNullable<AccommodationOverrides['geom']>

const readOwner = async (id: number) => {
  const db = getTestDb()
  const row = await db.query.owners.findFirst({ where: eq(owners.id, id) })
  if (!row) throw new Error(`owner ${id} introuvable`)
  return row
}

beforeEach(async () => {
  await createUser({ id: 'test-admin-id', name: 'Test Admin', email: 'admin@test.com', role: 'admin' })
  await createUser({ id: 'test-owner-id', name: 'Test Owner', email: 'owner@test.com', role: 'owner' })
})

describe('owner.updatedAt/updatedBy — tamponnage sur la fiche bailleur', () => {
  it('admin.owners.update tamponne la date et son auteur', async () => {
    const owner = await createOwner({ name: 'Bailleur Suivi', slug: 'bailleur-suivi' })
    expect((await readOwner(owner.id)).updatedAt).toBeNull()

    await adminCaller.admin.owners.update({ id: owner.id, name: 'Bailleur Suivi Renommé' })

    const updated = await readOwner(owner.id)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(updated.updatedBy).toBe('test-admin-id')
  })

  it('admin.owners.updateLogo tamponne aussi (le logo est une modif de la fiche)', async () => {
    const owner = await createOwner({ name: 'Bailleur Logo', slug: 'bailleur-logo' })

    await adminCaller.admin.owners.updateLogo({
      id: owner.id,
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    })

    const updated = await readOwner(owner.id)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(updated.updatedBy).toBe('test-admin-id')
  })

  it("bailleur.setContactMode tamponne l'utilisateur bailleur, pas un admin", async () => {
    const owner = await createOwner({ name: 'Bailleur Mode', slug: 'bailleur-mode', userId: 'test-owner-id' })

    await ownerCaller.bailleur.setContactMode({ mode: EOwnerContactMode.CONTACTS })

    const updated = await readOwner(owner.id)
    expect(updated.updatedAt).toBeInstanceOf(Date)
    expect(updated.updatedBy).toBe('test-owner-id')
  })

  it('un bailleur fraîchement créé reste à NULL (NULL = jamais modifié, pas la date de création)', async () => {
    const created = await adminCaller.admin.owners.create({ name: 'Bailleur Neuf' })

    const row = await readOwner(created.id)
    expect(row.updatedAt).toBeNull()
    expect(row.updatedBy).toBeNull()
  })

  it("une modif de résidence ne touche pas la fiche bailleur (l'activité vit dans activity_log)", async () => {
    const owner = await createOwner({ name: 'Bailleur Résidence', slug: 'bailleur-residence', userId: 'test-owner-id' })
    await createAccommodation({ name: 'Résidence Suivi', slug: 'residence-suivi', ownerId: owner.id, geom: parisPoint }, [
      typologyDraft('t1', { nbTotal: 10 }),
    ])

    await ownerCaller.bailleur.updateAvailability({
      slug: 'residence-suivi',
      availability: [{ type: 't1', nbAvailable: 4 }],
    })

    const row = await readOwner(owner.id)
    expect(row.updatedAt).toBeNull()
    expect(row.updatedBy).toBeNull()
  })
})

describe('admin.owners.getById — restitution de l’auteur', () => {
  it("expose le nom de l'auteur de la dernière modification", async () => {
    const owner = await createOwner({ name: 'Bailleur Auteur', slug: 'bailleur-auteur' })
    await adminCaller.admin.owners.update({ id: owner.id, name: 'Bailleur Auteur bis' })

    const detail = await adminCaller.admin.owners.getById({ id: owner.id })
    expect(detail.updatedAt).toBeInstanceOf(Date)
    expect(detail.updatedByName).toBe('Test Admin')
  })

  it('renvoie updatedByName null quand la fiche n’a jamais été modifiée', async () => {
    const owner = await createOwner({ name: 'Bailleur Vierge', slug: 'bailleur-vierge' })

    const detail = await adminCaller.admin.owners.getById({ id: owner.id })
    expect(detail.updatedAt).toBeNull()
    expect(detail.updatedByName).toBeNull()
  })

  it("garde la date mais perd l'auteur si le compte est supprimé (FK ON DELETE SET NULL)", async () => {
    const owner = await createOwner({ name: 'Bailleur Orphelin', slug: 'bailleur-orphelin' })
    await adminCaller.admin.owners.update({ id: owner.id, name: 'Bailleur Orphelin bis' })
    const stampedAt = (await readOwner(owner.id)).updatedAt

    const db = getTestDb()
    await db.delete(user).where(eq(user.id, 'test-admin-id'))

    const row = await readOwner(owner.id)
    expect(row.updatedBy).toBeNull()
    expect(row.updatedAt).toEqual(stampedAt)

    const detail = await adminCaller.admin.owners.getById({ id: owner.id })
    expect(detail.updatedByName).toBeNull()
  })
})
