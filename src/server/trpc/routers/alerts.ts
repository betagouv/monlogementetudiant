import { and, eq, inArray, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { bboxSelect } from '~/server/trpc/utils/spatial-helpers'
import { createTRPCRouter, protectedProcedure } from '../init'

type AlertMatchInput = {
  cityId: number | null
  departmentId: number | null
  academyId: number | null
  hasColiving: boolean
  isAccessible: boolean
  maxPrice: number
}

function buildAlertMatchConditions(alert: AlertMatchInput): SQL[] {
  const conditions: SQL[] = [eq(accommodations.published, true), sql`${accommodations.priceMin} <= ${alert.maxPrice}`]

  if (alert.hasColiving) {
    conditions.push(sql`${accommodations.nbColivingApartments} > 0`)
  }
  if (alert.isAccessible) {
    conditions.push(sql`${accommodations.nbAccessibleApartments} > 0`)
  }

  if (alert.cityId) {
    conditions.push(
      sql`ST_Intersects(${accommodations.geom}, (SELECT ${cities.boundary} FROM ${cities} WHERE ${cities.id} = ${alert.cityId}))`,
    )
  } else if (alert.departmentId) {
    conditions.push(
      sql`ST_Intersects(${accommodations.geom}, (SELECT ${departments.boundary} FROM ${departments} WHERE ${departments.id} = ${alert.departmentId}))`,
    )
  } else if (alert.academyId) {
    conditions.push(
      sql`ST_Intersects(${accommodations.geom}, (SELECT ${academies.boundary} FROM ${academies} WHERE ${academies.id} = ${alert.academyId}))`,
    )
  }

  return conditions
}

function countQuery(alert: AlertMatchInput) {
  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(accommodations)
    .where(and(...buildAlertMatchConditions(alert)))
}

export const alertsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
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

    const cityIds = [...new Set(alerts.map((a) => a.cityId).filter((id): id is number => id != null))]
    const deptIds = [...new Set([...alerts.map((a) => a.departmentId).filter((id): id is number => id != null)])]
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
    const cityMap = new Map(cityRows.map((c) => [c.id, c]))
    const deptMap = new Map(allDepts.map((d) => [d.id, d]))
    const academyMap = new Map(academyRows.map((a) => [a.id, a]))

    const results = await Promise.all(
      alerts.map(async (alert) => {
        const [countResult] = await countQuery(alert)
        const count = countResult?.count ?? 0

        let city = null
        if (alert.cityId) {
          const c = cityMap.get(alert.cityId)
          if (c) {
            const dep = deptMap.get(c.departmentId)
            city = {
              id: c.id,
              name: c.name,
              slug: c.slug,
              bbox: c.bbox,
              department: dep
                ? { id: dep.id, name: dep.name, code: dep.code, bbox: dep.bbox }
                : { id: 0, name: '', code: '', bbox: { xmin: 0, xmax: 0, ymin: 0, ymax: 0 } },
            }
          }
        }

        const dep = alert.departmentId ? deptMap.get(alert.departmentId) : null
        const department = dep ? { id: dep.id, name: dep.name, code: dep.code, bbox: dep.bbox } : null

        const acad = alert.academyId ? academyMap.get(alert.academyId) : null
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
      }),
    )

    return results
  }),

  create: protectedProcedure.input(ZCreateAlertRequest).mutation(async ({ ctx, input }) => {
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

  update: protectedProcedure.input(ZUpdateAlertRequest).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id
    const { id, ...fields } = input

    const updateData: Record<string, unknown> = {}
    if (fields.name !== undefined) updateData.name = fields.name
    if (fields.city_id !== undefined) updateData.cityId = fields.city_id
    if (fields.department_id !== undefined) updateData.departmentId = fields.department_id
    if (fields.academy_id !== undefined) updateData.academyId = fields.academy_id
    if (fields.has_coliving !== undefined) updateData.hasColiving = fields.has_coliving
    if (fields.is_accessible !== undefined) updateData.isAccessible = fields.is_accessible
    if (fields.max_price !== undefined) updateData.maxPrice = fields.max_price
    if (fields.receive_notifications !== undefined) updateData.receiveNotifications = fields.receive_notifications

    const [row] = await db
      .update(studentAlerts)
      .set(updateData)
      .where(and(eq(studentAlerts.id, id), eq(studentAlerts.userId, userId)))
      .returning()

    return row
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id

    await db.delete(studentAlerts).where(and(eq(studentAlerts.id, input.id), eq(studentAlerts.userId, userId)))

    return { success: true }
  }),
})
