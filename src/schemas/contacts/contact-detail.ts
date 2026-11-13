import { z } from 'zod'
import { ZContactStatus } from '~/enums/contact-status'
import { ZStudyYear } from '~/enums/study-year'

/**
 * Forme des candidatures telles que les fiches détail de l'espace gestionnaire les consomment.
 *
 * Les deux canaux — demande de contact et candidature DossierFacile — partagent le socle
 * `ZContactDetail` ; seul DossierFacile ajoute le dossier et ses pièces.
 */

/** Une pièce du dossier DossierFacile, telle qu'exposée au gestionnaire (jamais l'URL brute). */
export const ZContactDocument = z.object({
  id: z.string(),
  documentCategory: z.string(),
  documentSubCategory: z.string().nullable(),
})

export type TContactDocument = z.infer<typeof ZContactDocument>

/**
 * Les dates arrivent en `Date` via superjson, mais restent tolérées en chaîne ISO pour les
 * appelants qui n'en bénéficient pas (rendu serveur, données déjà sérialisées).
 */
const ZTimestamp = z.union([z.string(), z.date()])

/** Champs candidat communs à une candidature DossierFacile et à une demande de contact. */
export const ZContactDetail = z.object({
  id: z.string(),
  status: ZContactStatus,
  createdAt: ZTimestamp,
  reviewedAt: ZTimestamp.nullable(),
  studentName: z.string().nullable(),
  studentEmail: z.string().nullable(),
  studentPhone: z.string().nullable(),
  studentBirthdate: z.string().nullable(),
  scholarshipStatus: z.string().nullable(),
  isWorkStudy: z.boolean().nullable(),
  studyInstitution: z.string().nullable(),
  studyYear: ZStudyYear.nullable(),
  accommodationName: z.string(),
})

export type TContactDetail = z.infer<typeof ZContactDetail>

export const ZCandidatureDetail = ZContactDetail.extend({
  dfTenantId: z.string(),
  hasTenantUrl: z.boolean(),
  hasPdfUrl: z.boolean(),
  documents: z.object({
    tenant: z.array(ZContactDocument),
    guarantor: z.array(ZContactDocument),
  }),
})

export type TCandidatureDetail = z.infer<typeof ZCandidatureDetail>
