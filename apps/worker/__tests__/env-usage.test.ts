import fs from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'
import { WEB_ONLY_ENV } from '~/server/env'
import { REPO_ROOT } from '~/server/jobs/repo-root'

const ENV_READ = /\b(?:process\.)?env\.([A-Z][A-Z0-9_]+)/g
const ENV_DESTRUCTURING = /\{([^{}]*)\}\s*=\s*(?:process\.)?env\b/g

async function workerReachableFiles(): Promise<string[]> {
  const result = await build({
    absWorkingDir: REPO_ROOT,
    entryPoints: ['apps/worker/index.ts', 'apps/worker/worker.ts'],
    bundle: true,
    write: false,
    metafile: true,
    platform: 'node',
    format: 'esm',
    splitting: true,
    outdir: 'out',
    packages: 'external',
    logLevel: 'silent',
    loader: { '.png': 'empty', '.svg': 'empty', '.css': 'empty' },
  })
  return Object.keys(result.metafile.inputs).filter((file) => !file.includes('node_modules') && file !== 'src/server/env.ts')
}

function envKeysRead(files: string[]): Map<string, string[]> {
  const reads = new Map<string, string[]>()
  const record = (key: string, file: string) => reads.set(key, [...(reads.get(key) ?? []), file])
  for (const file of files) {
    const source = fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8')
    for (const [, key] of source.matchAll(ENV_READ)) record(key, file)
    for (const [, body] of source.matchAll(ENV_DESTRUCTURING)) {
      for (const [key] of body.matchAll(/[A-Z][A-Z0-9_]+(?=\s*[:,}]|\s*$)/g)) record(key, file)
    }
  }
  return reads
}

describe('variables d’environnement lues par le worker', () => {
  it('ne lit aucune variable réservée à l’app web', async () => {
    const reads = envKeysRead(await workerReachableFiles())

    expect(reads.has('BREVO_API_KEY')).toBe(true)
    expect(reads.has('IBAIL_API_HOST')).toBe(true)
    expect(WEB_ONLY_ENV.filter((key) => reads.has(key)).map((key) => `${key} (${reads.get(key)?.join(', ')})`)).toEqual([])
  }, 30_000)
})
