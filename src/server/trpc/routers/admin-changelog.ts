import { readChangelogEntries } from '~/server/changelog/read-entries'
import { adminProcedure, createTRPCRouter } from '../init'

export const adminChangelogRouter = createTRPCRouter({
  /** Entrées du changelog (fichiers `changelog/*.md`), triées de la plus récente à la plus ancienne. */
  list: adminProcedure.query(() => readChangelogEntries()),
})
