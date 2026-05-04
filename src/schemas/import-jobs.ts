import { z } from 'zod'

export const ZImportJobType = z.enum([
  'csv',
  'arpej-ibail',
  'fac-habitat',
  'initiall',
  'sync-cities',
  'sync-rents',
  'sync-students',
  'sync-stats',
])
export type TImportJobType = z.infer<typeof ZImportJobType>

// Tout ce qui ne contient pas "sync" est un import (vs. job de synchro/cron)
export function isImportJob(type: string): boolean {
  return !type.includes('sync')
}

export const IMPORT_JOB_TYPES = ZImportJobType.options.filter(isImportJob)

export const ZImportJobStatus = z.enum(['running', 'done', 'error'])
export type TImportJobStatus = z.infer<typeof ZImportJobStatus>

export const ZImportJobResidence = z.object({
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  action: z.enum(['created', 'updated']),
})
export type TImportJobResidence = z.infer<typeof ZImportJobResidence>

export const ZImportJobSummary = z.object({
  created: z.number().optional(),
  updated: z.number().optional(),
  skipped: z.number().optional(),
  errors: z.array(z.string()).optional(),
  ownerId: z.number().optional(),
  ownerName: z.string().optional(),
  residences: z.array(ZImportJobResidence).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})
export type TImportJobSummary = z.infer<typeof ZImportJobSummary>
