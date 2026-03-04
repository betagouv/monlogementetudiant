import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../src/server/db/schema'

const conn = postgres(process.env.DATABASE_URL!, { prepare: false })
export const db = drizzle(conn, { schema })
export const closeDb = () => conn.end()
