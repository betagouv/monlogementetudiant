import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../src/server/db/schema'

interface DjangoUser {
  id: string
  email: string
  first_name: string
  last_name: string
  password: string
  is_active: boolean
  date_joined: string
  role?: string
}

export async function migrateUsers(opts: { file: string }) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('✗ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log("✓ Variables d'environnement chargées")

  const conn = postgres(databaseUrl, { prepare: false })
  const db = drizzle(conn, { schema })

  const raw = readFileSync(opts.file, 'utf-8')
  const users: DjangoUser[] = JSON.parse(raw)

  console.log(`→ Migration de ${users.length} utilisateurs...`)

  let migrated = 0
  let skipped = 0

  for (const djangoUser of users) {
    const name = `${djangoUser.first_name} ${djangoUser.last_name}`.trim() || djangoUser.email

    try {
      await db.insert(schema.user).values({
        id: String(djangoUser.id),
        email: djangoUser.email,
        emailVerified: djangoUser.is_active,
        name,
        firstname: djangoUser.first_name || '',
        lastname: djangoUser.last_name || '',
        role: djangoUser.role || 'user',
        createdAt: new Date(djangoUser.date_joined),
        updatedAt: new Date(),
      }).onConflictDoNothing()

      await db.insert(schema.account).values({
        id: randomUUID(),
        userId: String(djangoUser.id),
        accountId: djangoUser.email,
        providerId: 'credential',
        password: djangoUser.password,
        createdAt: new Date(djangoUser.date_joined),
        updatedAt: new Date(),
      }).onConflictDoNothing()

      migrated++
    } catch (error) {
      console.error(`  ✗ Échec pour ${djangoUser.email}:`, error)
      skipped++
    }
  }

  console.log(`✓ Migration terminée : ${migrated} migrés, ${skipped} ignorés`)

  // Link owners to users by matching name
  console.log('→ Liaison des owners aux utilisateurs...')
  const allOwners = await db.select().from(schema.owners)
  let linked = 0
  for (const owner of allOwners) {
    if (owner.userId) continue
    const matchingUsers = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.name, owner.name))
      .limit(1)
    if (matchingUsers[0]) {
      await db.update(schema.owners).set({ userId: matchingUsers[0].id }).where(eq(schema.owners.id, owner.id))
      linked++
    }
  }
  console.log(`✓ ${linked} owners liés`)

  await conn.end()
  console.log('\n✓ Migration terminée !')
}
