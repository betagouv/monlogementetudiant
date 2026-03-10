import { type AnyColumn, sql } from 'drizzle-orm'

export const bboxSelect = (table: { boundary: AnyColumn }) =>
  sql<{ xmin: number; xmax: number; ymin: number; ymax: number }>`
    json_build_object(
      'xmin', ST_XMin(ST_Envelope(${table.boundary})),
      'xmax', ST_XMax(ST_Envelope(${table.boundary})),
      'ymin', ST_YMin(ST_Envelope(${table.boundary})),
      'ymax', ST_YMax(ST_Envelope(${table.boundary}))
    )
  `
