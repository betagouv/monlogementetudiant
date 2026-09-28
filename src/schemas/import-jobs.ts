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
  'alert-detection',
  'alert-expiration',
  'applications-inactivity',
  'purge-contacts',
  'purge-logs',
  'backup-db',
])
export type TImportJobType = z.infer<typeof ZImportJobType>

// Crons qui ne touchent pas aux résidences : ni import, ni synchro de données.
const MAINTENANCE_JOB_TYPES: string[] = [
  'alert-detection',
  'alert-expiration',
  'applications-inactivity',
  'purge-contacts',
  'purge-logs',
  'backup-db',
]

// Tout ce qui ne contient pas "sync" et n'est pas un job de maintenance est un import.
export function isImportJob(type: string): boolean {
  return !type.includes('sync') && !MAINTENANCE_JOB_TYPES.includes(type)
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
  // Purge RGPD des candidatures (`purge-contacts`)
  deleted: z.number().optional(),
  anonymized: z.number().optional(),
  dossiersPurged: z.number().optional(),
})
export type TImportJobSummary = z.infer<typeof ZImportJobSummary>
