import { generateId } from 'better-auth'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { readFileSync } from 'fs'
import path from 'path'
import postgres from 'postgres'
import * as schema from '../../src/server/db/schema'

interface DjangoUser {
  id: string
  email: string
  first_name: string
  last_name: string
  password: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
}

export async function migrateUsers() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('✗ DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log("✓ Variables d'environnement chargées")

  const conn = postgres(databaseUrl, { prepare: false })
  const db = drizzle(conn, { schema })

  try {
    // Apply 0000_initial.sql directly (schema only, no cleanup)
    // This creates better-auth tables without dropping Django tables needed for migration
    console.log('→ Application du schema initial (0000_initial.sql)...')
    const initialSql = readFileSync(path.resolve('./drizzle/0000_initial.sql'), 'utf-8')
    // Split on drizzle statement breakpoints and execute each statement
    const statements = initialSql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean)
    for (const stmt of statements) {
      await conn.unsafe(stmt)
    }
    console.log('✓ Schema initial appliqué')

    const users = (await db.execute(sql`
      SELECT id, email, first_name, last_name, password, is_active, is_staff, is_superuser, date_joined
      FROM auth_user
    `)) as unknown as DjangoUser[]

    console.log(`→ Migration de ${users.length} utilisateurs...`)

    let migrated = 0
    let skipped = 0

    for (const djangoUser of users) {
      const name = `${djangoUser.first_name} ${djangoUser.last_name}`.trim() || djangoUser.email

      try {
        const newId = generateId()
        const inserted = await db
          .insert(schema.user)
          .values({
            id: newId,
            legacyId: Number(djangoUser.id),
            email: djangoUser.email,
            emailVerified: djangoUser.is_active,
            name,
            firstname: djangoUser.first_name || '',
            lastname: djangoUser.last_name || '',
            role: 'user',
            legacyUser: true,
            createdAt: new Date(djangoUser.date_joined),
            updatedAt: new Date(),
          })
          .onConflictDoNothing()
          .returning({ id: schema.user.id })

        if (inserted.length > 0) {
          await db
            .insert(schema.account)
            .values({
              id: generateId(),
              userId: inserted[0].id,
              accountId: djangoUser.email,
              providerId: 'credential',
              password: djangoUser.password,
              createdAt: new Date(djangoUser.date_joined),
              updatedAt: new Date(),
            })
            .onConflictDoNothing()
          migrated++
        } else {
          console.log(`  ⏭ ${djangoUser.email || `(no email, id=${djangoUser.id})`} ignoré (doublon)`)
          skipped++
        }
      } catch (error) {
        console.error(`  ✗ Échec pour ${djangoUser.email}:`, error)
        skipped++
      }
    }

    console.log(`✓ Migration terminée : ${migrated} migrés, ${skipped} ignorés`)

    // Link owners to users via Django's account_owner_users junction table
    console.log('→ Liaison des owners aux utilisateurs...')
    const linkResult = await db.execute(sql`
      UPDATE "user" SET owner_id = aou.owner_id
      FROM account_owner_users aou
      WHERE "user".legacy_id = aou.user_id
      AND "user".owner_id IS NULL
    `)
    console.log(`✓ ${linkResult.count} owners liés`)

    // Drop Django FK constraints and convert user_id columns from integer to text
    console.log('→ Conversion des colonnes user_id en text...')
    // Drop all FK constraints on user_id referencing auth_user
    const fkConstraints = (await db.execute(sql`
      SELECT tc.table_name, tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'auth_user'
      AND kcu.column_name = 'user_id'
    `)) as unknown as { table_name: string; constraint_name: string }[]
    for (const fk of fkConstraints) {
      console.log(`  Dropping FK ${fk.constraint_name} on ${fk.table_name}`)
      await db.execute(sql.raw(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`))
    }
    await db.execute(sql`ALTER TABLE accommodation_favoriteaccommodation ALTER COLUMN user_id TYPE varchar(255) USING user_id::varchar`)
    console.log('✓ Colonnes converties')

    // Update legacy user_id references to UUIDs
    console.log('→ Mise à jour des user_id dans les favoris...')
    const favResult = await db.execute(sql`
      UPDATE accommodation_favoriteaccommodation SET user_id = u.id
      FROM "user" u
      WHERE u.legacy_id = accommodation_favoriteaccommodation.user_id::integer
      AND u.legacy_id IS NOT NULL
    `)
    console.log(`✓ ${favResult.count} favoris mis à jour`)

    // Migrate alerts from Django alerts_accommodationalert → student_alert
    // Django uses student_id (FK to account_student) which itself has user_id (FK to auth_user)
    console.log('→ Migration des alertes...')
    const alertResult = await db.execute(sql`
      INSERT INTO student_alert (id, user_id, name, city_id, department_id, academy_id, has_coliving, is_accessible, max_price, receive_notifications, created_at)
      SELECT a.id, u.id, a.name, a.city_id, a.department_id, a.academy_id, a.has_coliving, a.is_accessible, a.max_price, a.receive_notifications, a.created_at
      FROM alerts_accommodationalert a
      JOIN account_student s ON s.id = a.student_id
      JOIN "user" u ON u.legacy_id = s.user_id
      ON CONFLICT (id) DO NOTHING
    `)
    console.log(`✓ ${alertResult.count} alertes migrées`)

    // Flag roles: owner by default via junction table, then admin wins at the end
    console.log('→ Flagging owners...')
    const ownerResult = await db.execute(sql`
      UPDATE "user" SET role = 'owner'
      WHERE legacy_id IN (SELECT user_id FROM account_owner_users)
    `)
    console.log(`✓ ${ownerResult.count} owners flaggés`)

    console.log('→ Flagging étudiants...')
    const studentResult = await db.execute(sql`
      UPDATE "user" SET role = 'user'
      WHERE legacy_id IN (SELECT user_id FROM account_student)
    `)
    console.log(`✓ ${studentResult.count} étudiants flaggés`)

    // Admin wins: only is_superuser = admin (is_staff = owner, already flagged above)
    console.log('→ Flagging admins...')
    const adminResult = await db.execute(sql`
      UPDATE "user" SET role = 'admin'
      WHERE legacy_id IN (
        SELECT id FROM auth_user WHERE is_superuser = true
      )
      AND role != 'admin'
    `)
    console.log(`✓ ${adminResult.count} admins flaggés`)
  } finally {
    await conn.end()
  }

  console.log('\n✓ Migration terminée !')
}
