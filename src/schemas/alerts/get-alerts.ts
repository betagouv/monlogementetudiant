import { z } from 'zod'
import { ZBbox } from '~/schemas/territories'

const ZAlertDepartment = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  ...ZBbox,
})

const ZAlertCity = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  department: ZAlertDepartment,
})

const ZAlertAcademy = z.object({
  id: z.number(),
  name: z.string(),
  ...ZBbox,
})

const ZAlert = z.object({
  id: z.number(),
  count: z.number(),
  name: z.string(),
  city: ZAlertCity.nullable(),
  department: ZAlertDepartment.nullable(),
  academy: ZAlertAcademy.nullable(),
  has_coliving: z.boolean(),
  is_accessible: z.boolean(),
  max_price: z.number(),
  receive_notifications: z.boolean(),
})

export const ZGetAlertsResponse = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(ZAlert),
})

export type TGetAlertsResponse = z.infer<typeof ZGetAlertsResponse>
export type TAlert = z.infer<typeof ZAlert>
