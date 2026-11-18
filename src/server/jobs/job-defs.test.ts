import { describe, expect, it } from 'vitest'
import { ZImportJobType } from '~/schemas/import-jobs'
import { IMPORT_JOB_TYPE_BY_IDENTIFIER, SCHEDULED_JOBS } from './job-defs'

describe('IMPORT_JOB_TYPE_BY_IDENTIFIER', () => {
  it('rattache chaque type import_job planifié à une tâche du planning', () => {
    const mapped = new Set(Object.values(IMPORT_JOB_TYPE_BY_IDENTIFIER))
    const unmapped = ZImportJobType.options.filter((type) => type !== 'csv' && !mapped.has(type))
    expect(unmapped).toEqual([])
  })

  it('ne référence que des tâches planifiées', () => {
    const scheduled = new Set(SCHEDULED_JOBS.map((job) => job.identifier))
    expect(Object.keys(IMPORT_JOB_TYPE_BY_IDENTIFIER).filter((id) => !scheduled.has(id))).toEqual([])
  })
})
