import { getTestDb } from './test-db'

export const db = getTestDb()
export const closeDb = () => Promise.resolve()
