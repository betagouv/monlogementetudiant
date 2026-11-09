import { z } from 'zod'

export const ZStatisticsPeriod = z.enum(['7d', '30d', '90d'])

export type TStatisticsPeriod = z.infer<typeof ZStatisticsPeriod>
