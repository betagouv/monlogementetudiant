import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { accommodations } from '~/server/db/schema/accommodations'
import { executeCsvImport } from '~/server/lib/import/csv-importer'
import { createOwner } from './fixtures/factories'
import { getTestDb } from './helpers/test-db'
import './helpers/setup-integration'

describe('executeCsvImport — équipements et charges', () => {
  it('importe le wifi et le détail des charges', async () => {
    await createOwner({ slug: 'bailleur-wifi' })
    const csv = [
      'owner_slug;name;address;city;postal_code;latitude;longitude;wifi;rental_charges_details',
      'bailleur-wifi;Résidence Wifi;1 rue de la Paix;Limoux;11300;43.05;2.21;TRUE;chauffage, eau et ménage',
    ].join('\n')

    await executeCsvImport(csv, 'csv', vi.fn())

    const [row] = await getTestDb().select().from(accommodations).where(eq(accommodations.name, 'Résidence Wifi'))
    expect(row.wifi).toBe(true)
    expect(row.rentalChargesDetails).toBe('chauffage, eau et ménage')
  })
})
