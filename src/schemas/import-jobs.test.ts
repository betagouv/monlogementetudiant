import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { importJobs } from '~/server/db/schema/import-jobs'
import { ZImportJobType } from './import-jobs'

describe('ZImportJobType', () => {
  it('tient dans la colonne import_job.type', () => {
    const column = getTableConfig(importJobs).columns.find((c) => c.name === 'type')
    const length = (column as { length?: number } | undefined)?.length
    expect(length).toBeDefined()
    for (const type of ZImportJobType.options) expect(type.length, type).toBeLessThanOrEqual(length as number)
  })
})
