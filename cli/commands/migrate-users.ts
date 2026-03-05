import { generateId } from 'better-auth'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
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

  // Apply Drizzle migrations (0000-0009) before user migration
  console.log('→ Application des migrations Drizzle (pré-cleanup)...')
  const migrationConn = postgres(databaseUrl, { prepare: false, max: 1 })
  await migrate(drizzle(migrationConn), { migrationsFolder: './drizzle' })
  await migrationConn.end()
  console.log('✓ Migrations appliquées')

  const conn = postgres(databaseUrl, { prepare: false })
  const db = drizzle(conn, { schema })

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
      const inserted = await db.insert(schema.user).values({
        id: newId,
        legacyId: Number(djangoUser.id),
        email: djangoUser.email,
        emailVerified: djangoUser.is_active,
        name,
        firstname: djangoUser.first_name || '',
        lastname: djangoUser.last_name || '',
        role: djangoUser.is_staff || djangoUser.is_superuser ? 'admin' : 'user',
        legacyUser: true,
        createdAt: new Date(djangoUser.date_joined),
        updatedAt: new Date(),
      }).onConflictDoNothing().returning({ id: schema.user.id })

      if (inserted.length > 0) {
        await db.insert(schema.account).values({
          id: generateId(),
          userId: inserted[0].id,
          accountId: djangoUser.email,
          providerId: 'credential',
          password: djangoUser.password,
          createdAt: new Date(djangoUser.date_joined),
          updatedAt: new Date(),
        }).onConflictDoNothing()
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
    UPDATE account_owner SET user_id = u.id
    FROM account_owner_users aou
    JOIN "user" u ON u.legacy_id = aou.user_id
    WHERE account_owner.id = aou.owner_id
    AND account_owner.user_id IS NULL
  `)
  console.log(`✓ ${linkResult.count} owners liés`)

  // Drop Django FK constraints and convert user_id columns from integer to text
  console.log('→ Conversion des colonnes user_id en text...')
  // Drop all FK constraints on user_id referencing auth_user
  const fkConstraints = await db.execute(sql`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'auth_user'
    AND kcu.column_name = 'user_id'
  `) as unknown as { table_name: string; constraint_name: string }[]
  for (const fk of fkConstraints) {
    console.log(`  Dropping FK ${fk.constraint_name} on ${fk.table_name}`)
    await db.execute(sql.raw(`ALTER TABLE "${fk.table_name}" DROP CONSTRAINT "${fk.constraint_name}"`))
  }
  await db.execute(sql`ALTER TABLE accommodation_favoriteaccommodation ALTER COLUMN user_id TYPE varchar(255) USING user_id::varchar`)
  await db.execute(sql`ALTER TABLE student_alert ALTER COLUMN user_id TYPE varchar(255) USING user_id::varchar`)
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

  console.log('→ Mise à jour des user_id dans les alertes...')
  const alertResult = await db.execute(sql`
    UPDATE student_alert SET user_id = u.id
    FROM "user" u
    WHERE u.legacy_id = student_alert.user_id::integer
    AND u.legacy_id IS NOT NULL
  `)
  console.log(`✓ ${alertResult.count} alertes mises à jour`)

  // Flag owners (via account_owner_users junction table)
  console.log('→ Flagging owners...')
  const ownerResult = await db.execute(sql`
    UPDATE "user" SET role = 'owner'
    WHERE legacy_id IN (SELECT user_id FROM account_owner_users)
    AND role = 'user'
  `)
  console.log(`✓ ${ownerResult.count} owners flaggés`)

  // Flag students from Django account_student table
  console.log('→ Flagging étudiants...')
  const studentResult = await db.execute(sql`
    UPDATE "user" SET role = 'student'
    WHERE legacy_id IN (SELECT user_id FROM account_student)
    AND role = 'user'
  `)
  console.log(`✓ ${studentResult.count} étudiants flaggés`)

  // Cleanup: drop Django legacy tables
  console.log('→ Suppression des tables Django...')
  await db.execute(sql`
    DROP TABLE IF EXISTS "auth_user_user_permissions" CASCADE;
    DROP TABLE IF EXISTS "auth_user_groups" CASCADE;
    DROP TABLE IF EXISTS "auth_group_permissions" CASCADE;
    DROP TABLE IF EXISTS "auth_permission" CASCADE;
    DROP TABLE IF EXISTS "auth_group" CASCADE;
    DROP TABLE IF EXISTS "account_owner_users" CASCADE;
    DROP TABLE IF EXISTS "account_student" CASCADE;
    DROP TABLE IF EXISTS "account_studentregistrationtoken" CASCADE;
    DROP TABLE IF EXISTS "auth_user" CASCADE;
    DROP TABLE IF EXISTS "django_admin_log" CASCADE;
    DROP TABLE IF EXISTS "django_session" CASCADE;
    DROP TABLE IF EXISTS "django_migrations" CASCADE;
    DROP TABLE IF EXISTS "django_summernote_attachment" CASCADE;
    DROP TABLE IF EXISTS "token_blacklist_blacklistedtoken" CASCADE;
    DROP TABLE IF EXISTS "token_blacklist_outstandingtoken" CASCADE;
    DROP TABLE IF EXISTS "admin_two_factor_twofactorverification" CASCADE;
    DROP TABLE IF EXISTS "accommodation_accommodationapplication" CASCADE;
    DROP TABLE IF EXISTS "alerts_accommodationalert" CASCADE;
    DROP TABLE IF EXISTS "dossier_facile_dossierfacileapplication" CASCADE;
    DROP TABLE IF EXISTS "dossier_facile_dossierfacileoauthstate" CASCADE;
    DROP TABLE IF EXISTS "dossier_facile_dossierfaciletenant" CASCADE;
    DROP TABLE IF EXISTS "institution_educationalinstitution" CASCADE;
    DROP TABLE IF EXISTS "qa_questionanswer" CASCADE;
    DROP TABLE IF EXISTS "qa_questionanswerglobal" CASCADE;
    DROP TABLE IF EXISTS "stats_accommodationchangelog" CASCADE;
    DROP TABLE IF EXISTS "stats_gestionnaireloginevent" CASCADE;
    DROP TABLE IF EXISTS "territories_country" CASCADE
  `)
  console.log('✓ Tables Django supprimées')

  await conn.end()
  console.log('\n✓ Migration terminée !')
}
