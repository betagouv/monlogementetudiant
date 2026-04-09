import { eq } from 'drizzle-orm'
import { eventStats, stats } from '../../src/server/db/schema'
import { db } from '../lib/db'
import { getAllEvents, getCompleteStats } from '../lib/matomo'
import type { SyncCommand, SyncOptions, SyncResult } from '../types'

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const current = new Date(from + 'T12:00:00')
  const end = new Date(to + 'T12:00:00')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function syncSingleDate(date: string, options: SyncOptions): Promise<'updated' | 'skipped'> {
  if (options.dryRun) {
    console.log(`  🔍 [dry-run] ${date}`)
    return 'updated'
  }

  const syncStats = !options.only || options.only === 'stats'
  const syncEvents = !options.only || options.only === 'events'

  const existing = await db.select({ id: stats.id }).from(stats).where(eq(stats.date, date)).limit(1)

  if (existing[0] && !options.force && !options.only) {
    console.log(`  ⏭️ Stats du ${date} existent déjà (--force pour écraser)`)
    return 'skipped'
  }

  const [completeStats, events] = await Promise.all([syncStats ? getCompleteStats(date) : null, syncEvents ? getAllEvents(date) : null])

  const parts: string[] = []
  if (completeStats) parts.push(`${completeStats.uniqueVisitors} visiteurs`)
  if (events) parts.push(`${events.length} events`)
  console.log(`  📊 ${date} — ${parts.join(', ')}`)

  if (completeStats) {
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
  }

  if (events && events.length > 0) {
    await db.delete(eventStats).where(eq(eventStats.date, date))
    await db.insert(eventStats).values(
      events.map((event) => ({
        date,
        category: event.category,
        action: event.action,
        nbEvents: event.nbEvents,
        nbUniqueEvents: event.nbUniqueEvents,
        eventValue: event.eventValue,
      })),
    )
  }

  return 'updated'
}

const command: SyncCommand = {
  name: 'stats',
  description: 'Sync des statistiques Matomo',

  async execute(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = { updated: 0, skipped: 0, errors: [] }

    if (!process.env.MATOMO_URL || !process.env.MATOMO_TOKEN || !process.env.MATOMO_ID_SITE) {
      throw new Error('Missing env vars: MATOMO_URL, MATOMO_TOKEN, MATOMO_ID_SITE')
    }

    const dates = options.from ? generateDateRange(options.from, options.to ?? getYesterday()) : [options.date ?? getYesterday()]

    console.log(`  📅 ${dates.length} jour(s) à synchroniser${options.only ? ` (${options.only} uniquement)` : ''}`)

    for (const date of dates) {
      try {
        const status = await syncSingleDate(date, options)
        result[status === 'updated' ? 'updated' : 'skipped']++
        await sleep(2000)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ Erreur pour le ${date}: ${msg}`)
        result.errors.push(`${date}: ${msg}`)
        await sleep(2000)
      }
    }

    return result
  },
}

export default command
