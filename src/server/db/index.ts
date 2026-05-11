import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '~/server/env'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
}

const conn = globalForDb.conn ?? postgres(env.DATABASE_URL, { prepare: false })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
}

export const db = drizzle(conn, { schema })
export const closeDb = () => conn.end()
