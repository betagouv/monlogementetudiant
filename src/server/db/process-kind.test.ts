import { describe, expect, it } from 'vitest'
import { processKindFromArgv } from './process-kind'

describe('processKindFromArgv', () => {
  it.each([
    ['/app/apps/worker/index.ts', 'cli'],
    ['/app/apps/worker/worker.ts', 'worker'],
    ['C:\\app\\apps\\worker\\worker.ts', 'worker'],
    ['/app/node_modules/next/dist/bin/next', 'web'],
    [undefined, 'web'],
  ])('%s → %s', (argv1, kind) => {
    expect(processKindFromArgv(argv1)).toBe(kind)
  })
})
