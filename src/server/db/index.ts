import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '~/server/env'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined
}

// Toutes les commandes CLI (imports, syncs, purges, crons one-off) passent par `cli/index.ts`.
// En cas de doute on considère le process comme un serveur web : c'est le réglage le plus large.
const isCliProcess = !process.env.NEXT_RUNTIME && /cli[\\/]index\.ts$/.test(process.argv[1] ?? '')
const isWorkerProcess = !process.env.NEXT_RUNTIME && /cli[\\/]worker\.ts$/.test(process.argv[1] ?? '')

/**
 * Le plafond de connexions de la base (140 en prod) est partagé par TOUS les process : chaque
 * container web, chaque one-off de cron, chaque session psql. `postgres-js` ouvre jusqu'à `max`
 * connexions par process et ne les referme jamais de lui-même au repos — `idle_timeout` vaut `null`
 * par défaut. Sans borne, une poignée de containers immobilise la moitié du plafond en dormant.
 *
 * Les requêtes de l'app sont courtes : au-delà de quelques connexions simultanées par instance,
 * mieux vaut faire patienter une requête quelques millisecondes que confisquer un slot à tout le
 * monde. Un process CLI, lui, enchaîne ses requêtes en séquence et n'a presque rien à paralléliser.
 *
 * `DATABASE_POOL_MAX` permet de réajuster sans redéploiement si la mesure dit le contraire :
 * `SELECT application_name, state, count(*) FROM pg_stat_activity GROUP BY 1, 2`.
 */
const max = env.DATABASE_POOL_MAX ?? (isCliProcess ? 2 : isWorkerProcess ? 3 : 5)

/** Sans ça, toutes les connexions s'affichent sous `postgres.js` dans `pg_stat_activity`. */
function applicationName(): string {
  if (process.env.VITEST) return 'mle-test'
  if (isWorkerProcess) return 'mle-worker'
  if (!isCliProcess) return 'mle-web'
  const command = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('-'))
    .join(' ')
  return `mle-cli:${command || 'inconnu'}`.slice(0, 63)
}

const conn =
  globalForDb.conn ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max,
    // Rend au plafond partagé les connexions ouvertes pendant un pic et devenues inutiles depuis.
    idle_timeout: 60,
    connection: { application_name: applicationName() },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.conn = conn
}

export const db = drizzle(conn, { schema })
export const closeDb = () => conn.end()
