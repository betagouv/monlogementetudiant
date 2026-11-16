import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))

export const CLI_ENTRY = path.join(REPO_ROOT, 'apps/worker/index.ts')
