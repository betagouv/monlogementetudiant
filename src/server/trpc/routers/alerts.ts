import * as Sentry from '@sentry/nextjs'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { enqueueJobsForNewAlert } from '~/server/services/alert-detector'
import { ALERT_EXPIRY_REMINDER_DAYS, ALERT_LIFETIME_DAYS } from '~/server/services/alert-expiration'
import { type AlertMatchInput, buildAlertMatchConditions } from '~/server/services/alert-matching'
import { sendAlertCreationConfirmationEmail } from '~/server/services/brevo'
import { bboxSelect } from '~/server/trpc/utils/spatial-helpers'
import { DAY_MS } from '~/utils/time'
import { createTRPCRouter, userProcedure } from '../init'

function countQuery(alert: AlertMatchInput) {
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(accommodations)
    .where(and(...buildAlertMatchConditions(alert)))
}

/** Batch-fetch territory lookup maps for a set of alerts. */
async function fetchTerritoryMaps(alerts: { cityId: number | null; departmentId: number | null; academyId: number | null }[]) {
  const cityIds = [...new Set(alerts.map((a) => a.cityId).filter((id): id is number => id != null))]
  const deptIds = [...new Set(alerts.map((a) => a.departmentId).filter((id): id is number => id != null))]
  const academyIds = [...new Set(alerts.map((a) => a.academyId).filter((id): id is number => id != null))]

  const [cityRows, deptRows, academyRows] = await Promise.all([
    cityIds.length > 0
      ? db
          .select({
            id: cities.id,
            name: cities.name,
            slug: cities.slug,
            bbox: bboxSelect(cities),
            departmentId: cities.departmentId,
          })
          .from(cities)
          .where(inArray(cities.id, cityIds))
      : [],
    deptIds.length > 0
      ? db
          .select({
            id: departments.id,
            name: departments.name,
            slug: departments.slug,
            code: departments.code,
            bbox: bboxSelect(departments),
          })
          .from(departments)
          .where(inArray(departments.id, deptIds))
      : [],
    academyIds.length > 0
      ? db
          .select({
            id: academies.id,
            name: academies.name,
            slug: academies.slug,
            bbox: bboxSelect(academies),
          })
          .from(academies)
          .where(inArray(academies.id, academyIds))
      : [],
  ])

  // Also fetch departments for cities (for the nested department in city)
  const cityDeptIds = [...new Set(cityRows.map((c) => c.departmentId).filter((id): id is number => id != null))]
  const missingDeptIds = cityDeptIds.filter((id) => !deptRows.some((d) => d.id === id))
  const extraDeptRows =
    missingDeptIds.length > 0
      ? await db
          .select({
            id: departments.id,
            name: departments.name,
            slug: departments.slug,
            code: departments.code,
            bbox: bboxSelect(departments),
          })
          .from(departments)
          .where(inArray(departments.id, missingDeptIds))
      : []

  const allDepts = [...deptRows, ...extraDeptRows]

  return {
    cityMap: new Map(cityRows.map((c) => [c.id, c])),
    deptMap: new Map(allDepts.map((d) => [d.id, d])),
    academyMap: new Map(academyRows.map((a) => [a.id, a])),
  }
}

const DEFAULT_DEPT = { id: 0, name: '', slug: '', code: '', bbox: { xmin: 0, xmax: 0, ymin: 0, ymax: 0 } }

/** Format a single alert row into the API response shape. */
function formatAlert(
  alert: {
    id: number
    name: string
    cityId: number | null
    departmentId: number | null
    academyId: number | null
    hasColiving: boolean
    isAccessible: boolean
    maxPrice: number
    receiveNotifications: boolean
    renewedAt: Date
    expiryReminderSentAt: Date | null
    expiredAt: Date | null
  },
  count: number,
  maps: Awaited<ReturnType<typeof fetchTerritoryMaps>>,
) {
  let city = null
  if (alert.cityId) {
    const c = maps.cityMap.get(alert.cityId)
    if (c) {
      const dep = maps.deptMap.get(c.departmentId) ?? DEFAULT_DEPT
      city = { id: c.id, name: c.name, slug: c.slug, bbox: c.bbox, department: dep }
    }
  }

  const dep = alert.departmentId ? maps.deptMap.get(alert.departmentId) : null
  const department = dep ? { id: dep.id, name: dep.name, slug: dep.slug, code: dep.code, bbox: dep.bbox } : null

  const acad = alert.academyId ? maps.academyMap.get(alert.academyId) : null
  const academy = acad ? { id: acad.id, name: acad.name, slug: acad.slug, bbox: acad.bbox } : null

  const expiresAt = alert.expiryReminderSentAt
    ? new Date(alert.expiryReminderSentAt.getTime() + ALERT_EXPIRY_REMINDER_DAYS * DAY_MS)
    : new Date(alert.renewedAt.getTime() + ALERT_LIFETIME_DAYS * DAY_MS)

  return {
    id: alert.id,
    count,
    name: alert.name,
    city,
    department,
    academy,
    hasColiving: alert.hasColiving,
    isAccessible: alert.isAccessible,
    maxPrice: alert.maxPrice,
    receiveNotifications: alert.receiveNotifications,
    expiresAt: expiresAt.toISOString(),
    expired: alert.expiredAt != null,
  }
}

/** Keep only the defined fields so partial updates don't overwrite columns with undefined. */
function buildUpdateData(fields: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      updateData[key] = value
    }
  }
  return updateData
}

export const alertsRouter = createTRPCRouter({
  list: userProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id

    const alerts = await db
      .select({
        id: studentAlerts.id,
        name: studentAlerts.name,
        cityId: studentAlerts.cityId,
        departmentId: studentAlerts.departmentId,
        academyId: studentAlerts.academyId,
        hasColiving: studentAlerts.hasColiving,
        isAccessible: studentAlerts.isAccessible,
        maxPrice: studentAlerts.maxPrice,
        receiveNotifications: studentAlerts.receiveNotifications,
        renewedAt: studentAlerts.renewedAt,
        expiryReminderSentAt: studentAlerts.expiryReminderSentAt,
        expiredAt: studentAlerts.expiredAt,
      })
      .from(studentAlerts)
      .where(eq(studentAlerts.userId, userId))

    const maps = await fetchTerritoryMaps(alerts)

    const results = await Promise.all(
      alerts.map(async (alert) => {
        const [countResult] = await countQuery(alert)
        const count = countResult?.count ?? 0
        return formatAlert(alert, count, maps)
      }),
    )

    return results
  }),

  create: userProcedure.input(ZCreateAlertRequest).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    const [row] = await db
      .insert(studentAlerts)
      .values({
        userId,
        name: input.name,
        cityId: input.cityId ?? null,
        departmentId: input.departmentId ?? null,
        academyId: input.academyId ?? null,
        hasColiving: input.hasColiving,
        isAccessible: input.isAccessible,
        maxPrice: input.maxPrice,
      })
      .returning()

    const [[cityRow], [academyRow]] = await Promise.all([
      input.cityId ? db.select({ name: cities.name }).from(cities).where(eq(cities.id, input.cityId)) : [],
      input.academyId ? db.select({ name: academies.name }).from(academies).where(eq(academies.id, input.academyId)) : [],
    ])

    await sendAlertCreationConfirmationEmail(ctx.session.user.email, {
      alertName: input.name,
      city: cityRow?.name,
      academy: academyRow?.name,
      maxBudget: input.maxPrice,
    })

    try {
      await enqueueJobsForNewAlert(row.id)
    } catch (error) {
      console.error('enqueueJobsForNewAlert failed:', error)
      Sentry.captureException(error)
    }

    return row
  }),

  update: userProcedure.input(ZUpdateAlertRequest).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const { id, ...fields } = input

    const updateData = buildUpdateData(fields)

    const criteriaEdited = Object.keys(updateData).some((key) => key !== 'receiveNotifications')
    const reactivated = updateData.receiveNotifications === true

    if (criteriaEdited || reactivated) {
      updateData.renewedAt = new Date()
      updateData.expiryReminderSentAt = null
      updateData.expiredAt = null
    }

    const [row] = await db
      .update(studentAlerts)
      .set(updateData)
      .where(and(eq(studentAlerts.id, id), eq(studentAlerts.userId, userId)))
      .returning()

    if (!row) return row

    if (criteriaEdited) {
      const [[cityRow], [academyRow]] = await Promise.all([
        row.cityId ? db.select({ name: cities.name }).from(cities).where(eq(cities.id, row.cityId)) : [],
        row.academyId ? db.select({ name: academies.name }).from(academies).where(eq(academies.id, row.academyId)) : [],
      ])

      await sendAlertCreationConfirmationEmail(ctx.session.user.email, {
        alertName: row.name,
        city: cityRow?.name,
        academy: academyRow?.name,
        maxBudget: row.maxPrice,
      })
    }

    try {
      await enqueueJobsForNewAlert(row.id)
    } catch (error) {
      console.error('enqueueJobsForNewAlert failed:', error)
      Sentry.captureException(error)
    }

    return row
  }),

  delete: userProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    await db.delete(studentAlerts).where(and(eq(studentAlerts.id, input.id), eq(studentAlerts.userId, userId)))

    return { success: true }
  }),
})
