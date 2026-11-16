import { inArray } from 'drizzle-orm'
import { closeDb, db } from '~/server/db'
import { user } from '~/server/db/schema'
import { syncBrevoOwnerCreated, syncBrevoStudentCreated } from '~/server/services/brevo'

interface BackfillOptions {
  dryRun?: boolean
  verbose?: boolean
  limit?: number
  batchSize?: number
}

// Brevo limite l'API contacts à ~10 req/s : on borne la concurrence et on espace les lots.
const DEFAULT_BATCH_SIZE = 5
const DELAY_BETWEEN_BATCHES_MS = 1100

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Rôles rattrapés : 'user' (étudiants) et 'owner' (gestionnaires).
const ROLES_TO_BACKFILL = ['user', 'owner'] as const

export async function backfillBrevoContacts(options: BackfillOptions = {}): Promise<void> {
  const { dryRun = false, verbose = false, limit, batchSize = DEFAULT_BATCH_SIZE } = options

  console.log(`→ Rattrapage des contacts Brevo${dryRun ? ' (DRY-RUN, aucun appel Brevo)' : ''}`)

  try {
    const query = db
      .select({
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(inArray(user.role, [...ROLES_TO_BACKFILL]))

    const users = limit ? await query.limit(limit) : await query

    const owners = users.filter((u) => u.role === 'owner').length
    const students = users.length - owners
    console.log(`→ ${users.length} utilisateurs à traiter (${owners} gestionnaires, ${students} étudiants)`)

    let synced = 0
    let failed = 0
    const errors: string[] = []

    const processOne = async (u: (typeof users)[number]): Promise<void> => {
      const fullName = `${u.firstname} ${u.lastname}`.trim() || u.email

      if (dryRun) {
        if (verbose) {
          const date = u.role === 'owner' ? u.createdAt.toISOString().split('T')[0] : '∅'
          console.log(`  [dry-run] ${u.role === 'owner' ? 'GESTIONNAIRE' : 'ÉTUDIANT'} ${u.email} (${fullName}) date=${date}`)
        }
        synced++
        return
      }

      try {
        if (u.role === 'owner') {
          await syncBrevoOwnerCreated(u.email, {
            firstname: u.firstname,
            lastname: u.lastname,
            createdAt: u.createdAt,
          })
        } else {
          await syncBrevoStudentCreated(u.email, {
            firstname: u.firstname,
            lastname: u.lastname,
          })
        }
        synced++
        if (verbose) console.log(`  ✓ ${u.email}`)
      } catch (error) {
        failed++
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${u.email}: ${message}`)
        console.error(`  ✗ ${u.email}: ${message}`)
      }
    }

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)
      await Promise.all(batch.map(processOne))

      const done = Math.min(i + batchSize, users.length)
      console.log(`  … ${done}/${users.length} traités`)

      if (!dryRun && done < users.length) await sleep(DELAY_BETWEEN_BATCHES_MS)
    }

    console.log(`\n✓ Terminé : ${synced} synchronisés, ${failed} en échec`)
    if (errors.length > 0) {
      console.log('\nDétail des échecs :')
      for (const e of errors) console.log(`  - ${e}`)
    }
  } finally {
    await closeDb()
  }
}
