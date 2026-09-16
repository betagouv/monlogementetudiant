import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { trackingEvents } from '~/server/db/schema'
import { createAccommodation } from './fixtures/factories'
import './helpers/setup-integration'
import { caller } from './helpers/test-caller'
import { getTestDb } from './helpers/test-db'

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}))

describe('tracking.logAccommodationView', () => {
  it("n'enregistre aucun referer, même si un client en envoie un", async () => {
    const accommodation = await createAccommodation({ slug: 'res-tracking' })

    await caller.tracking.logAccommodationView({
      accommodationId: accommodation.id,
      // Champ supprimé : ignoré s'il est encore envoyé.
      ...({ referer: 'A'.repeat(100_000) } as object),
    })

    const [event] = await getTestDb().select().from(trackingEvents).where(eq(trackingEvents.accommodationId, accommodation.id))
    expect(event).toBeDefined()
    expect(event!.metadata).toBeNull()
  })
})
