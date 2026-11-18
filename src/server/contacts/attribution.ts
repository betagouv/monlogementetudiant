import { sql } from 'drizzle-orm'
import { EContactStatus } from '~/enums/contact-status'
import type { contactRequests, dossierFacileApplications } from '~/server/db/schema'

export type TAttribution = 'oui' | 'non' | 'non_renseigne'

export const attributionOf = (row: { status: EContactStatus; contactedAt: Date | null }): TAttribution | null => {
  if (row.status === EContactStatus.LOGEMENT_ATTRIBUE) return 'oui'
  if (row.status === EContactStatus.CONTACTE) return 'non_renseigne'
  if (row.status === EContactStatus.NON_RETENU && row.contactedAt) return 'non'
  return null
}

export const attributionCounts = (table: typeof contactRequests | typeof dossierFacileApplications) => ({
  oui: sql<number>`(count(*) filter (where ${table.status} = ${EContactStatus.LOGEMENT_ATTRIBUE}))::int`,
  non: sql<number>`(count(*) filter (where ${table.status} = ${EContactStatus.NON_RETENU} and ${table.contactedAt} is not null))::int`,
  nonRenseigne: sql<number>`(count(*) filter (where ${table.status} = ${EContactStatus.CONTACTE}))::int`,
})
