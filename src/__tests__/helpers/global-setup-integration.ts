import { availableParallelism } from 'node:os'
import type { TestProject } from 'vitest/node'
import { setupTestDb } from './test-db'

/** Même résolution que Vitest pour le nombre de workers : une base de test est clonée pour chacun. */
function resolveWorkerCount(project: TestProject) {
  return project.config.maxWorkers || project.vitest.config.maxWorkers || Math.max(availableParallelism() - 1, 1)
}

export default async function setup(project: TestProject) {
  await setupTestDb(resolveWorkerCount(project))
}
