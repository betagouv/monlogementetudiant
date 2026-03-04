import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { getCompleteStats, getAllEvents } from '../lib/matomo'
import { stats, eventStats } from '../../src/server/db/schema'
import type { SyncCommand, SyncOptions, SyncResult } from '../types'

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const command: SyncCommand = {
  name: 'stats',
  description: 'Sync des statistiques Matomo',

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    if (!process.env.MATOMO_URL || !process.env.MATOMO_TOKEN || !process.env.MATOMO_ID_SITE) {
      throw new Error('Missing env vars: MATOMO_URL, MATOMO_TOKEN, MATOMO_ID_SITE')
    }

    const date = options.date ?? getYesterday()

    // Check if stats already exist for this date
    const existing = await db
      .select({ id: stats.id })
      .from(stats)
      .where(eq(stats.date, date))
      .limit(1)

    if (existing[0] && !options.force) {
      console.log(`  ⏭️ Stats du ${date} existent déjà (--force pour écraser)`)
      result.skipped++
      return result
    }

    if (options.dryRun) {
      console.log(`  🔍 [dry-run] Stats du ${date}`)
      result.updated++
      return result
    }

    // Collect stats
    console.log(`  📊 Collecte stats du ${date}...`)
    const completeStats = await getCompleteStats(date)

    const statsValues = {
      date,
      uniqueVisitors: completeStats.uniqueVisitors,
      newVisitsPercentage: completeStats.newVisitsPercentage,
      averageDuration: completeStats.averageDuration,
      bounceRatePercentage: completeStats.bounceRatePercentage,
      pageViews: completeStats.pageViews,
      visitorsPerPage: completeStats.visitorsPerPage,
      topPages: completeStats.topPages,
      mainEntryPages: completeStats.mainEntryPages,
      mainSources: completeStats.mainSources,
    }

    if (existing[0]) {
      await db.update(stats).set(statsValues).where(eq(stats.id, existing[0].id))
    } else {
      await db.insert(stats).values(statsValues)
    }
    result.updated++

    // Collect events
    console.log(`  📈 Collecte events du ${date}...`)
    const events = await getAllEvents(date)
    console.log(`  ✓ ${events.length} events récupérés`)

    // Delete existing events for this date if force
    if (existing[0]) {
      await db.delete(eventStats).where(eq(eventStats.date, date))
    }

    for (const event of events) {
      await db.insert(eventStats).values({
        date,
        category: event.category,
        action: event.action,
        nbEvents: event.nbEvents,
        nbUniqueEvents: event.nbUniqueEvents,
        eventValue: event.eventValue,
      })
      result.updated++
    }

    return result
  },
}

export default command
