import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAccommodation, createOwner, createUser } from './fixtures/factories'
import './helpers/setup-integration'

type MockUser = {
  id: string
  role: 'admin' | 'owner' | 'user'
  bailleurRole?: 'administrator' | 'gestionnaire' | null
  bailleurPermissions?: string[]
}

const mockSession = vi.hoisted(() => ({ current: null as null | { user: MockUser; session: object } }))

vi.mock('~/services/better-auth', () => ({ getServerSession: vi.fn(() => mockSession.current) }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  },
}))

import { getAccommodationMyById } from '~/server/bailleur/get-accommodation-my-by-id'

const signInAs = (user: MockUser) => {
  mockSession.current = { user, session: {} }
}

beforeEach(async () => {
  await createUser({ id: 'gest-read', email: 'gest-read@bailleur.fr', role: 'owner' })
  const owner = await createOwner({ name: 'Bailleur Fiche', slug: 'bailleur-fiche', userId: 'gest-read' })
  await createAccommodation({ slug: 'res-fiche', name: 'Résidence Fiche', ownerId: owner.id })
})

describe('fiche résidence côté bailleur', () => {
  it('refuse un gestionnaire sans la permission manage_residences', async () => {
    signInAs({ id: 'gest-read', role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_applications'] })

    await expect(getAccommodationMyById('res-fiche')).rejects.toThrow(/NEXT_REDIRECT/)
  })

  it('ouvre la fiche à un gestionnaire habilité', async () => {
    signInAs({ id: 'gest-read', role: 'owner', bailleurRole: 'gestionnaire', bailleurPermissions: ['manage_residences'] })

    await expect(getAccommodationMyById('res-fiche')).resolves.toMatchObject({ slug: 'res-fiche' })
  })

  it('ouvre la fiche à un administrateur du bailleur', async () => {
    signInAs({ id: 'gest-read', role: 'owner', bailleurRole: 'administrator', bailleurPermissions: [] })

    await expect(getAccommodationMyById('res-fiche')).resolves.toMatchObject({ slug: 'res-fiche' })
  })
})
