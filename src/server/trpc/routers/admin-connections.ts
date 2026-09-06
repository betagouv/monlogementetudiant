import { and, count, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ELoginAttemptStatus, ELoginOutcome, ZLoginOutcome } from '~/enums/login-attempt-status'
import { db } from '~/server/db'
import { user } from '~/server/db/schema/auth'
import { loginAttempts } from '~/server/db/schema/login-attempts'
import { owners } from '~/server/db/schema/owners'
import { adminProcedure, createTRPCRouter } from '../init'

const PAGE_SIZE = 25

/**
 * Issue d'une tentative, telle qu'affichée. Quatre états sont stockés ; le cinquième —
 * « lien expiré sans avoir jamais été ouvert », le plus fréquent des échecs — se déduit ici plutôt
 * que d'être réécrit en base par une tâche planifiée.
 */
const OUTCOME_SQL = sql<ELoginOutcome>`
  case
    when ${loginAttempts.status} = ${ELoginAttemptStatus.COMPLETED} then ${ELoginOutcome.COMPLETED}
    when ${loginAttempts.status} = ${ELoginAttemptStatus.EXPIRED} then ${ELoginOutcome.EXPIRED}
    when ${loginAttempts.status} = ${ELoginAttemptStatus.INVALID} then ${ELoginOutcome.INVALID}
    when ${loginAttempts.expiresAt} < now() then ${ELoginOutcome.NEVER_CLICKED}
    else ${ELoginOutcome.PENDING}
  end`

const countFilter = (condition: SQL) => sql<number>`count(*) filter (where ${condition})::int`

/** Délai entre l'envoi du lien et son ouverture, en secondes. `null` tant que rien n'a été ouvert. */
const DELAY_SECONDS_SQL = sql<number | null>`
  case when ${loginAttempts.verifiedAt} is null then null
  else extract(epoch from (${loginAttempts.verifiedAt} - ${loginAttempts.createdAt}))::int end`

/** Nom lisible du compte : l'état civil s'il est renseigné, sinon le nom du compte, sinon l'e-mail. */
const ACCOUNT_NAME_SQL = sql<string | null>`nullif(trim(concat_ws(' ', ${user.firstname}, ${user.lastname})), '')`

const listInput = z.object({
  page: z.number().default(1),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  outcome: ZLoginOutcome.optional(),
})

/**
 * Filtres communs à la liste et à la répartition, hors filtre d'issue : la répartition doit rester
 * lisible quand on clique sur l'une de ses tuiles.
 */
function baseConditions(input: { search?: string; from?: string; to?: string }): SQL[] {
  const conditions: SQL[] = []

  if (input.from && input.to) {
    conditions.push(sql`${loginAttempts.createdAt} >= ${input.from}::date and ${loginAttempts.createdAt} < (${input.to}::date + 1)`)
  }

  if (input.search && input.search.length >= 2) {
    const term = `%${input.search}%`
    const searchCondition = or(
      ilike(owners.name, term),
      ilike(user.firstname, term),
      ilike(user.lastname, term),
      ilike(user.name, term),
      ilike(loginAttempts.email, term),
    )
    if (searchCondition) conditions.push(searchCondition)
  }

  return conditions
}

export const adminConnectionsRouter = createTRPCRouter({
  /**
   * Tentatives de connexion sur la période, de la plus récente à la plus ancienne, accompagnées de
   * la répartition par issue.
   */
  list: adminProcedure.input(listInput).query(async ({ input }) => {
    const conditions = baseConditions(input)
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const filtered = input.outcome ? and(...conditions, eq(OUTCOME_SQL, input.outcome)) : where
    const offset = (input.page - 1) * PAGE_SIZE

    const [countResult, rows, outcomeRows] = await Promise.all([
      db
        .select({ count: count() })
        .from(loginAttempts)
        .leftJoin(user, eq(loginAttempts.userId, user.id))
        .leftJoin(owners, eq(loginAttempts.ownerId, owners.id))
        .where(filtered),
      db
        .select({
          id: loginAttempts.id,
          createdAt: loginAttempts.createdAt,
          email: loginAttempts.email,
          role: loginAttempts.role,
          accountName: ACCOUNT_NAME_SQL,
          ownerId: loginAttempts.ownerId,
          ownerName: owners.name,
          outcome: OUTCOME_SQL,
          verifiedAt: loginAttempts.verifiedAt,
          verifiedUserAgent: loginAttempts.verifiedUserAgent,
          delaySeconds: DELAY_SECONDS_SQL,
        })
        .from(loginAttempts)
        .leftJoin(user, eq(loginAttempts.userId, user.id))
        .leftJoin(owners, eq(loginAttempts.ownerId, owners.id))
        .where(filtered)
        .orderBy(desc(loginAttempts.createdAt))
        .limit(PAGE_SIZE)
        .offset(offset),
      // Répartition en agrégats filtrés plutôt qu'en `group by` sur l'expression d'issue : le même
      // `case` réapparaîtrait dans le `group by` avec d'autres numéros de paramètres, et Postgres
      // n'y reconnaîtrait pas la colonne sélectionnée.
      db
        .select({
          [ELoginOutcome.COMPLETED]: countFilter(sql`${loginAttempts.status} = ${ELoginAttemptStatus.COMPLETED}`),
          [ELoginOutcome.EXPIRED]: countFilter(sql`${loginAttempts.status} = ${ELoginAttemptStatus.EXPIRED}`),
          [ELoginOutcome.INVALID]: countFilter(sql`${loginAttempts.status} = ${ELoginAttemptStatus.INVALID}`),
          [ELoginOutcome.NEVER_CLICKED]: countFilter(
            sql`${loginAttempts.status} = ${ELoginAttemptStatus.EMAIL_SENT} and ${loginAttempts.expiresAt} < now()`,
          ),
          [ELoginOutcome.PENDING]: countFilter(
            sql`${loginAttempts.status} = ${ELoginAttemptStatus.EMAIL_SENT} and ${loginAttempts.expiresAt} >= now()`,
          ),
        })
        .from(loginAttempts)
        .leftJoin(user, eq(loginAttempts.userId, user.id))
        .leftJoin(owners, eq(loginAttempts.ownerId, owners.id))
        .where(where),
    ])

    const outcomeCounts = outcomeRows[0] ?? {
      [ELoginOutcome.COMPLETED]: 0,
      [ELoginOutcome.PENDING]: 0,
      [ELoginOutcome.NEVER_CLICKED]: 0,
      [ELoginOutcome.EXPIRED]: 0,
      [ELoginOutcome.INVALID]: 0,
    }

    const total = countResult[0]?.count ?? 0

    return {
      items: rows,
      outcomeCounts,
      total,
      pageCount: Math.ceil(total / PAGE_SIZE),
      page: input.page,
    }
  }),

  /**
   * Comptes ayant enchaîné les échecs sans jamais aboutir sur la période : ce sont eux qu'il faut
   * rappeler, plus que les échecs pris isolément.
   */
  strandedAccounts: adminProcedure.input(listInput.omit({ page: true, outcome: true })).query(async ({ input }) => {
    const conditions = baseConditions(input)
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const rows = await db
      .select({
        email: loginAttempts.email,
        accountName: ACCOUNT_NAME_SQL,
        ownerId: loginAttempts.ownerId,
        ownerName: owners.name,
        attempts: count(),
        completed: sql<number>`count(*) filter (where ${loginAttempts.status} = ${ELoginAttemptStatus.COMPLETED})::int`,
        lastAttemptAt: sql<Date>`max(${loginAttempts.createdAt})`,
      })
      .from(loginAttempts)
      .leftJoin(user, eq(loginAttempts.userId, user.id))
      .leftJoin(owners, eq(loginAttempts.ownerId, owners.id))
      .where(where)
      .groupBy(loginAttempts.email, ACCOUNT_NAME_SQL, loginAttempts.ownerId, owners.name)
      .having(sql`count(*) filter (where ${loginAttempts.status} = ${ELoginAttemptStatus.COMPLETED}) = 0`)
      .orderBy(desc(count()))
      .limit(20)

    return rows
  }),
})
