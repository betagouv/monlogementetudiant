import { and, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { owners } from '~/server/db/schema/owners'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { bboxSelect } from '~/server/trpc/utils/spatial-helpers'
import { createTRPCRouter, userProcedure } from '../init'

type AlertMatchInput = {
  cityId: number | null
  departmentId: number | null
  academyId: number | null
  hasColiving: boolean
  isAccessible: boolean
  maxPrice: number
}

/**
 * Build the spatial intersection condition for the alert's territory level.
 * Returns a single SQL condition or null if no territory is set.
 */
function buildTerritoryCondition(alert: Pick<AlertMatchInput, 'cityId' | 'departmentId' | 'academyId'>): SQL | null {
  const territoryLevels: { id: number | null; table: typeof cities | typeof departments | typeof academies }[] = [
    { id: alert.cityId, table: cities },
    { id: alert.departmentId, table: departments },
    { id: alert.academyId, table: academies },
  ]

  for (const { id, table } of territoryLevels) {
    if (id) {
      return sql`ST_Intersects(${accommodations.geom}, (SELECT ${table.boundary} FROM ${table} WHERE ${table.id} = ${id}))`
    }
  }
  return null
}

function buildAlertMatchConditions(alert: AlertMatchInput): SQL[] {
  const conditions: SQL[] = [
    eq(accommodations.published, true),
    sql`${accommodations.priceMin} <= ${alert.maxPrice}`,
    sql`(${accommodations.ownerId} IS NULL OR ${accommodations.ownerId} NOT IN (SELECT ${owners.id} FROM ${owners} WHERE ${owners.slug} = 'crous'))`,
  ]

  if (alert.hasColiving) {
    conditions.push(sql`${accommodations.nbColivingApartments} > 0`)
  }
  if (alert.isAccessible) {
    conditions.push(sql`${accommodations.nbAccessibleApartments} > 0`)
  }

  const territory = buildTerritoryCondition(alert)
  if (territory) {
    conditions.push(territory)
  }

  return conditions
}

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

const DEFAULT_DEPT = { id: 0, name: '', code: '', bbox: { xmin: 0, xmax: 0, ymin: 0, ymax: 0 } }

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
  const department = dep ? { id: dep.id, name: dep.name, code: dep.code, bbox: dep.bbox } : null

  const acad = alert.academyId ? maps.academyMap.get(alert.academyId) : null
  const academy = acad ? { id: acad.id, name: acad.name, bbox: acad.bbox } : null

  return {
    id: alert.id,
    count,
    name: alert.name,
    city,
    department,
    academy,
    has_coliving: alert.hasColiving,
    is_accessible: alert.isAccessible,
    max_price: alert.maxPrice,
    receive_notifications: alert.receiveNotifications,
  }
}

/** Map snake_case input fields to camelCase column names for partial updates. */
const UPDATE_FIELD_MAP: Record<string, string> = {
  name: 'name',
  city_id: 'cityId',
  department_id: 'departmentId',
  academy_id: 'academyId',
  has_coliving: 'hasColiving',
  is_accessible: 'isAccessible',
  max_price: 'maxPrice',
  receive_notifications: 'receiveNotifications',
}

function buildUpdateData(fields: Record<string, unknown>): Record<string, unknown> {
  const updateData: Record<string, unknown> = {}
  for (const [inputKey, columnKey] of Object.entries(UPDATE_FIELD_MAP)) {
    if (fields[inputKey] !== undefined) {
      updateData[columnKey] = fields[inputKey]
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
        cityId: input.city_id ?? null,
        departmentId: input.department_id ?? null,
        academyId: input.academy_id ?? null,
        hasColiving: input.has_coliving,
        isAccessible: input.is_accessible,
        maxPrice: input.max_price,
      })
      .returning()

    return row
  }),

  update: userProcedure.input(ZUpdateAlertRequest).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const { id, ...fields } = input

    const updateData = buildUpdateData(fields)

    const [row] = await db
      .update(studentAlerts)
      .set(updateData)
      .where(and(eq(studentAlerts.id, id), eq(studentAlerts.userId, userId)))
      .returning()

    return row
  }),

  delete: userProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    await db.delete(studentAlerts).where(and(eq(studentAlerts.id, input.id), eq(studentAlerts.userId, userId)))

    return { success: true }
  }),
})
