import { closeDb } from '~/server/db'
import { seedAvailabilitySnapshot } from '~/server/services/alert-detector'

interface SeedAlertSnapshotOptions {
  dryRun?: boolean
}

/**
 * Amorce le snapshot de disponibilité pour tout le stock publié hors CROUS, sans créer de
 * job. À jouer **une fois avant** d'activer la détection événementielle (voir ADR 0002),
 * pour que « pas de snapshot » signifie ensuite « résidence réellement nouvelle ».
 * Idempotente : ré-exécutable sans risque (upsert).
 */
export async function seedAlertSnapshotCommand(options: SeedAlertSnapshotOptions): Promise<void> {
  console.log('📸 Amorçage du snapshot de disponibilité (baseline)...')

  try {
    const { seeded } = await seedAvailabilitySnapshot({ dryRun: options.dryRun })

    if (options.dryRun) {
      console.log(`\n  [dry-run] ${seeded} résidence(s) auraient été enregistrées dans le snapshot`)
      return
    }

    console.log(`\n  ✅ ${seeded} résidence(s) enregistrées dans le snapshot`)
  } catch (error) {
    console.error(`\n❌ Amorçage échoué : ${error instanceof Error ? error.message : String(error)}`)
    throw error
  } finally {
    await closeDb()
  }
}
