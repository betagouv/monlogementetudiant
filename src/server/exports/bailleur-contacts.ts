import { and, asc, desc, eq, type SQL } from 'drizzle-orm'
import { EContactStatus } from '~/enums/contact-status'
import { EOwnerContactMode } from '~/enums/owner-contact-mode'
import { STUDY_YEAR_SHORT_LABELS } from '~/enums/study-year'
import { getAccommodationScope, scopeAccommodationIdCondition, scopeAllowsAccommodationId } from '~/server/bailleur/accommodation-scope'
import { getOwnerForUser } from '~/server/bailleur/get-owner-for-user'
import {
  CONTACT_BIRTHDATE_SQL,
  CONTACT_EMAIL_SQL,
  CONTACT_PHONE_SQL,
  CONTACT_SCHOLARSHIP_STATUS_SQL,
  CONTACT_STUDENT_NAME_SQL,
  CONTACT_STUDY_INSTITUTION_SQL,
  CONTACT_STUDY_YEAR_SQL,
  CONTACT_WORK_STUDY_SQL,
  DOSSIER_FACILE_STUDENT_NAME_SQL,
  parseStudyYear,
} from '~/server/candidatures/student-identity'
import { visibleContactRequest, visibleDossierFacileApplication } from '~/server/candidatures/visibility'
import { db } from '~/server/db'
import {
  accommodationAddresses,
  accommodations,
  cities,
  contactRequests,
  departments,
  dossierFacileApplications,
  dossierFacileTenants,
  user,
} from '~/server/db/schema'
import type { TCsvColumn } from '~/utils/csv'
import { formatIsoDate } from '~/utils/date-helpers'
import { getRegionByDepartmentCode } from '~/utils/french-regions'

export type TBailleurContactsExportFilters = { region?: string; residenceSlug?: string }

export type TBailleurContactExportRow = {
  residence: string
  ville: string | null
  departement: string | null
  region: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  dateNaissance: string | null
  boursier: string | null
  alternance: boolean | null
  etablissement: string | null
  anneeEtudes: string | null
  typeLogement: string | null
  statut: string
  dateDemande: string
}

export type TBailleurContactsExportResult =
  | { status: 'forbidden' }
  | { status: 'residence_not_found' }
  | { status: 'ok'; owner: { id: number; name: string; slug: string }; rows: TBailleurContactExportRow[] }

export const BAILLEUR_CONTACTS_EXPORT_COLUMNS: TCsvColumn<TBailleurContactExportRow>[] = [
  { key: 'residence', header: 'Résidence' },
  { key: 'ville', header: 'Ville' },
  { key: 'departement', header: 'Département' },
  { key: 'region', header: 'Région' },
  { key: 'nom', header: 'Nom' },
  { key: 'email', header: 'E-mail' },
  { key: 'telephone', header: 'Téléphone' },
  { key: 'dateNaissance', header: 'Date de naissance' },
  { key: 'boursier', header: 'Boursier' },
  { key: 'alternance', header: 'Alternance' },
  { key: 'etablissement', header: 'Établissement' },
  { key: 'anneeEtudes', header: "Année d'études" },
  { key: 'typeLogement', header: 'Type de logement' },
  { key: 'statut', header: 'Statut' },
  { key: 'dateDemande', header: 'Date de la demande' },
]

const STATUS_LABELS: Record<EContactStatus, string> = {
  [EContactStatus.A_MODERER]: 'À modérer',
  [EContactStatus.A_CONTACTER]: 'À contacter',
  [EContactStatus.CONTACTE]: 'Contacté',
  [EContactStatus.NON_RETENU]: 'Non retenu',
  [EContactStatus.LOGEMENT_ATTRIBUE]: 'Logement attribué',
}

const SCHOLARSHIP_LABELS: Record<string, string> = { yes: 'Oui', no: 'Non', unknown: 'Ne sait pas' }

type TRawRow = {
  residence: string
  ville: string | null
  departement: string | null
  nom: string | null
  email: string | null
  telephone: string | null
  dateNaissance: string | null
  boursier: string | null
  alternance: boolean | null
  etablissement: string | null
  anneeEtudes: string | null
  typeLogement: string | null
  statut: string
  createdAt: Date
}

const toExportRow = (raw: TRawRow): TBailleurContactExportRow => {
  const studyYear = parseStudyYear(raw.anneeEtudes)
  return {
    residence: raw.residence,
    ville: raw.ville,
    departement: raw.departement,
    region: getRegionByDepartmentCode(raw.departement),
    nom: raw.nom,
    email: raw.email,
    telephone: raw.telephone,
    dateNaissance: raw.dateNaissance ? formatIsoDate(raw.dateNaissance) : null,
    boursier: raw.boursier ? (SCHOLARSHIP_LABELS[raw.boursier] ?? null) : null,
    alternance: raw.alternance,
    etablissement: raw.etablissement,
    anneeEtudes: studyYear ? STUDY_YEAR_SHORT_LABELS[studyYear] : null,
    typeLogement: raw.typeLogement,
    statut: STATUS_LABELS[raw.statut as EContactStatus] ?? raw.statut,
    dateDemande: formatIsoDate(raw.createdAt),
  }
}

const mainAddressJoin = and(eq(accommodationAddresses.accommodationId, accommodations.id), eq(accommodationAddresses.isMain, true))

const fetchContactRequestRows = (accommodationConditions: SQL[]): Promise<TRawRow[]> =>
  db
    .select({
      residence: accommodations.name,
      ville: cities.name,
      departement: departments.code,
      nom: CONTACT_STUDENT_NAME_SQL,
      email: CONTACT_EMAIL_SQL,
      telephone: CONTACT_PHONE_SQL,
      dateNaissance: CONTACT_BIRTHDATE_SQL,
      boursier: CONTACT_SCHOLARSHIP_STATUS_SQL,
      alternance: CONTACT_WORK_STUDY_SQL,
      etablissement: CONTACT_STUDY_INSTITUTION_SQL,
      anneeEtudes: CONTACT_STUDY_YEAR_SQL,
      typeLogement: contactRequests.apartmentType,
      statut: contactRequests.status,
      createdAt: contactRequests.createdAt,
    })
    .from(contactRequests)
    .innerJoin(accommodations, eq(contactRequests.accommodationId, accommodations.id))
    .leftJoin(user, eq(contactRequests.userId, user.id))
    .leftJoin(accommodationAddresses, mainAddressJoin)
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .leftJoin(departments, eq(cities.departmentId, departments.id))
    .where(and(...accommodationConditions, visibleContactRequest()))
    .orderBy(asc(accommodations.name), desc(contactRequests.createdAt))

const fetchDossierFacileRows = (accommodationConditions: SQL[]): Promise<TRawRow[]> =>
  db
    .select({
      residence: accommodations.name,
      ville: cities.name,
      departement: departments.code,
      nom: DOSSIER_FACILE_STUDENT_NAME_SQL,
      email: user.email,
      telephone: user.phone,
      dateNaissance: user.birthdate,
      boursier: user.scholarshipStatus,
      alternance: user.isWorkStudy,
      etablissement: user.studyInstitution,
      anneeEtudes: user.studyYear,
      typeLogement: dossierFacileApplications.apartmentType,
      statut: dossierFacileApplications.status,
      createdAt: dossierFacileApplications.createdAt,
    })
    .from(dossierFacileApplications)
    .innerJoin(dossierFacileTenants, eq(dossierFacileApplications.tenantId, dossierFacileTenants.id))
    .innerJoin(accommodations, eq(dossierFacileApplications.accommodationSlug, accommodations.slug))
    .leftJoin(user, eq(dossierFacileTenants.userId, user.id))
    .leftJoin(accommodationAddresses, mainAddressJoin)
    .leftJoin(cities, eq(accommodationAddresses.cityId, cities.id))
    .leftJoin(departments, eq(cities.departmentId, departments.id))
    .where(and(...accommodationConditions, visibleDossierFacileApplication()))
    .orderBy(asc(accommodations.name), desc(dossierFacileApplications.createdAt))

const fetchRows = (mode: EOwnerContactMode, accommodationConditions: SQL[]): Promise<TRawRow[]> => {
  if (mode === EOwnerContactMode.CONTACTS) return fetchContactRequestRows(accommodationConditions)
  if (mode === EOwnerContactMode.DOSSIER_FACILE) return fetchDossierFacileRows(accommodationConditions)
  return Promise.resolve([])
}

export async function getBailleurContactsExport(params: {
  userId: string
  ownerId?: number
  filters: TBailleurContactsExportFilters
}): Promise<TBailleurContactsExportResult> {
  const owner = await getOwnerForUser(params.userId, params.ownerId)
  if (!owner) return { status: 'forbidden' }

  const scope = await getAccommodationScope(params.userId)
  const { residenceSlug, region } = params.filters

  const accommodationConditions = [eq(accommodations.ownerId, owner.id), scopeAccommodationIdCondition(scope)].filter(Boolean) as SQL[]

  if (residenceSlug) {
    const [residence] = await db
      .select({ id: accommodations.id })
      .from(accommodations)
      .where(and(eq(accommodations.slug, residenceSlug), eq(accommodations.ownerId, owner.id)))
      .limit(1)
    if (!residence || !scopeAllowsAccommodationId(scope, residence.id)) return { status: 'residence_not_found' }
    accommodationConditions.push(eq(accommodations.id, residence.id))
  }

  const rawRows = await fetchRows(owner.contactMode, accommodationConditions)

  const rows = rawRows.map(toExportRow).filter((row) => residenceSlug || !region || row.region === region)

  return { status: 'ok', owner: { id: owner.id, name: owner.name, slug: owner.slug }, rows }
}
