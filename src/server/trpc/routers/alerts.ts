import { type AnyColumn, and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ZCreateAlertRequest } from '~/schemas/alerts/create-alert'
import { ZUpdateAlertRequest } from '~/schemas/alerts/update-alert'
import { db } from '~/server/db'
import { academies } from '~/server/db/schema/academies'
import { accommodations } from '~/server/db/schema/accommodations'
import { cities } from '~/server/db/schema/cities'
import { departments } from '~/server/db/schema/departments'
import { studentAlerts } from '~/server/db/schema/student-alerts'
import { createTRPCRouter, protectedProcedure } from '../init'

const bboxSelect = (table: { boundary: AnyColumn }) =>
  sql<{ xmin: number; xmax: number; ymin: number; ymax: number }>`
    json_build_object(
      'xmin', ST_XMin(ST_Envelope(${table.boundary})),
      'xmax', ST_XMax(ST_Envelope(${table.boundary})),
      'ymin', ST_YMin(ST_Envelope(${table.boundary})),
      'ymax', ST_YMax(ST_Envelope(${table.boundary}))
    )
  `

function countQuery(alert: {
  cityId: number | null
  departmentId: number | null
  academyId: number | null
  hasColiving: boolean
  isAccessible: boolean
  maxPrice: number
}) {
  const conditions = [eq(accommodations.published, true), sql`${accommodations.priceMin} <= ${alert.maxPrice}`]

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

  return db
    .select({ count: sql<number>`count(*)::int` })
    .from(accommodations)
    .where(and(...conditions))
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

    const results = await Promise.all(
      alerts.map(async (alert) => {
        const [countResult] = await countQuery(alert)
        const count = countResult?.count ?? 0

        let city = null
        if (alert.cityId) {
          const [c] = await db
            .select({
              id: cities.id,
              name: cities.name,
              slug: cities.slug,
              bbox: bboxSelect(cities),
              departmentId: cities.departmentId,
            })
            .from(cities)
            .where(eq(cities.id, alert.cityId))

          if (c) {
            const [dep] = await db
              .select({
                id: departments.id,
                name: departments.name,
                code: departments.code,
                bbox: bboxSelect(departments),
              })
              .from(departments)
              .where(eq(departments.id, c.departmentId))

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

        let department = null
        if (alert.departmentId) {
          const [dep] = await db
            .select({
              id: departments.id,
              name: departments.name,
              code: departments.code,
              bbox: bboxSelect(departments),
            })
            .from(departments)
            .where(eq(departments.id, alert.departmentId))

          if (dep) {
            department = { id: dep.id, name: dep.name, code: dep.code, bbox: dep.bbox }
          }
        }

        let academy = null
        if (alert.academyId) {
          const [acad] = await db
            .select({
              id: academies.id,
              name: academies.name,
              bbox: bboxSelect(academies),
            })
            .from(academies)
            .where(eq(academies.id, alert.academyId))

          if (acad) {
            academy = { id: acad.id, name: acad.name, bbox: acad.bbox }
          }
        }

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
