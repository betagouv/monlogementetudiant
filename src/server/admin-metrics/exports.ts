import { EMetricItem, METRIC_ITEM_META } from '~/enums/metric-item'
import { ZMonth, ZMonthRange } from '~/schemas/admin-metrics/month-range'
import { getCandidaturesSeries } from '~/server/admin-metrics/candidatures'
import { getContactPathSeries, getOwnersToTarget } from '~/server/admin-metrics/contact-path'
import { getOwnerModeration, type TOwnerModerationRow } from '~/server/admin-metrics/moderation'
import { share } from '~/server/admin-metrics/months'
import { SEGMENT_LABELS } from '~/server/admin-metrics/segment'
import { getStudentSeries } from '~/server/admin-metrics/students'
import { getCityMetrics } from '~/server/admin-metrics/territories'
import { type TCsvColumn, toCsv } from '~/utils/csv'

export const EXPORT_MONTH_ITEMS = ['moderation', 'tension-marche', 'zones-detendues'] as const
export const EXPORT_RANGE_ITEMS = ['parcours-contact'] as const
export const EXPORT_STATIC_ITEMS = ['gestionnaires-a-cibler'] as const

export const UNKNOWN_ITEM_MESSAGE = 'Indicateur inconnu'

export type TExportRequest =
  | { kind: 'series'; item: EMetricItem; from: string; to: string }
  | { kind: 'range'; item: (typeof EXPORT_RANGE_ITEMS)[number]; from: string; to: string }
  | { kind: 'month'; item: (typeof EXPORT_MONTH_ITEMS)[number]; month: string }
  | { kind: 'static'; item: (typeof EXPORT_STATIC_ITEMS)[number] }

export type TExportResult = { filename: string; csv: string }

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value)
const isMetricItem = (value: string): value is EMetricItem => (Object.values(EMetricItem) as string[]).includes(value)

export type TExportParams = { item: string | null; from: string | null; to: string | null; month: string | null }

export const parseExportRequest = (
  params: TExportParams,
): { success: true; data: TExportRequest } | { success: false; message: string } => {
  const { item } = params
  if (!item) return { success: false, message: UNKNOWN_ITEM_MESSAGE }

  if (isOneOf(EXPORT_STATIC_ITEMS, item)) return { success: true, data: { kind: 'static', item } }

  if (isOneOf(EXPORT_MONTH_ITEMS, item)) {
    const month = ZMonth.safeParse(params.month ?? '')
    if (!month.success) return { success: false, message: month.error.issues[0]?.message ?? 'Mois invalide' }
    return { success: true, data: { kind: 'month', item, month: month.data } }
  }

  if (isOneOf(EXPORT_RANGE_ITEMS, item) || isMetricItem(item)) {
    const range = ZMonthRange.safeParse({ from: params.from ?? '', to: params.to ?? '' })
    if (!range.success) return { success: false, message: range.error.issues[0]?.message ?? 'Période invalide' }
    return isMetricItem(item)
      ? { success: true, data: { kind: 'series', item, ...range.data } }
      : { success: true, data: { kind: 'range', item: item as (typeof EXPORT_RANGE_ITEMS)[number], ...range.data } }
  }

  return { success: false, message: UNKNOWN_ITEM_MESSAGE }
}

const percent = (value: number | null) => (value === null ? '' : Math.round(value * 100))
const cell = (value: number | null) => value ?? ''

type TSeriesCsvRow = { mois: string; valeur: number | string; boursiers: number | string; part_boursiers: number | string; source: string }

const seriesColumns: TCsvColumn<TSeriesCsvRow>[] = [
  { key: 'mois', header: 'mois' },
  { key: 'valeur', header: 'valeur' },
  { key: 'boursiers', header: 'boursiers' },
  { key: 'part_boursiers', header: 'part_boursiers' },
  { key: 'source', header: 'source' },
]

const exportSeries = async ({ item, from, to }: Extract<TExportRequest, { kind: 'series' }>): Promise<TExportResult> => {
  const range = { from, to }
  const [candidatures, students] = await Promise.all([getCandidaturesSeries(range), getStudentSeries(range)])
  const series = [...candidatures, ...students].find((s) => s.key === item)
  const source = METRIC_ITEM_META[item].source
  const rows = (series?.values ?? []).map(
    (value): TSeriesCsvRow => ({
      mois: value.month,
      valeur: cell(value.total),
      boursiers: value.total === null ? '' : cell(value.boursiers),
      part_boursiers: percent(share(value.boursiers, value.total)),
      source,
    }),
  )
  return { filename: `metriques-${item}-${from}-${to}.csv`, csv: toCsv(seriesColumns, rows) }
}

type TContactPathCsvRow = {
  mois: string
  logements_publies_hors_crous: number | string
  logements_parcours_active: number | string
  part: number | string
  residences_sans_total: number | string
  gestionnaires_actives: number | string
  gestionnaires_avec_dispo: number | string
}

const contactPathColumns: TCsvColumn<TContactPathCsvRow>[] = [
  { key: 'mois', header: 'mois' },
  { key: 'logements_publies_hors_crous', header: 'logements_publies_hors_crous' },
  { key: 'logements_parcours_active', header: 'logements_parcours_active' },
  { key: 'part', header: 'part' },
  { key: 'residences_sans_total', header: 'residences_sans_total' },
  { key: 'gestionnaires_actives', header: 'gestionnaires_actives' },
  { key: 'gestionnaires_avec_dispo', header: 'gestionnaires_avec_dispo' },
]

const exportContactPath = async ({ item, from, to }: Extract<TExportRequest, { kind: 'range' }>): Promise<TExportResult> => {
  const months = await getContactPathSeries({ from, to })
  const rows = months.map(
    (m): TContactPathCsvRow => ({
      mois: m.month,
      logements_publies_hors_crous: cell(m.logementsPublies),
      logements_parcours_active: cell(m.logementsActives),
      part: percent(m.part),
      residences_sans_total: cell(m.residencesSansTotal),
      gestionnaires_actives: cell(m.gestionnairesActives),
      gestionnaires_avec_dispo: cell(m.gestionnairesAvecDispo),
    }),
  )
  return { filename: `metriques-${item}-${from}-${to}.csv`, csv: toCsv(contactPathColumns, rows) }
}

type TModerationCsvRow = {
  gestionnaire: string
  segment: string
  recus: number
  boursiers: number
  a_traiter: number
  traites: number
  jamais_traites: number
  part_jamais_traites: number | string
  contactes: number
  part_contactes: number | string
  delai_moyen_heures: number | string
  alertes: number
  suspensions: number
}

const moderationColumns: TCsvColumn<TModerationCsvRow>[] = [
  { key: 'gestionnaire', header: 'gestionnaire' },
  { key: 'segment', header: 'segment' },
  { key: 'recus', header: 'recus' },
  { key: 'boursiers', header: 'boursiers' },
  { key: 'a_traiter', header: 'a_traiter' },
  { key: 'traites', header: 'traites' },
  { key: 'jamais_traites', header: 'jamais_traites' },
  { key: 'part_jamais_traites', header: 'part_jamais_traites' },
  { key: 'contactes', header: 'contactes' },
  { key: 'part_contactes', header: 'part_contactes' },
  { key: 'delai_moyen_heures', header: 'delai_moyen_heures' },
  { key: 'alertes', header: 'alertes' },
  { key: 'suspensions', header: 'suspensions' },
]

export const moderationCsvRow = (o: TOwnerModerationRow): TModerationCsvRow => ({
  gestionnaire: o.ownerName,
  segment: SEGMENT_LABELS[o.segment],
  recus: o.recus,
  boursiers: o.recusBoursiers,
  a_traiter: o.aTraiter,
  traites: o.traites,
  jamais_traites: o.jamaisTraites,
  part_jamais_traites: percent(share(o.jamaisTraites, o.recus)),
  contactes: o.contactes,
  part_contactes: percent(share(o.contactes, o.recus)),
  delai_moyen_heures: cell(o.delaiMoyenHeures),
  alertes: o.alertes,
  suspensions: o.suspensions,
})

const exportModeration = async ({ item, month }: Extract<TExportRequest, { kind: 'month' }>): Promise<TExportResult> => {
  const owners = await getOwnerModeration(month)
  return { filename: `metriques-${item}-${month}.csv`, csv: toCsv(moderationColumns, owners.map(moderationCsvRow)) }
}

type TTensionCsvRow = {
  ville: string
  disponibles: number | string
  total_renseigne: number | string
  total_publie: number | string
  tension: number | string
  couverture: number | string
}

const tensionColumns: TCsvColumn<TTensionCsvRow>[] = [
  { key: 'ville', header: 'ville' },
  { key: 'disponibles', header: 'disponibles' },
  { key: 'total_renseigne', header: 'total_renseigne' },
  { key: 'total_publie', header: 'total_publie' },
  { key: 'tension', header: 'tension' },
  { key: 'couverture', header: 'couverture' },
]

type TZonesCsvRow = {
  ville: string
  recherches: number
  residences_ouvertes: number | string
  sans_contact: number | string
  part_sans_contact: number | string
}

const zonesColumns: TCsvColumn<TZonesCsvRow>[] = [
  { key: 'ville', header: 'ville' },
  { key: 'recherches', header: 'recherches' },
  { key: 'residences_ouvertes', header: 'residences_ouvertes' },
  { key: 'sans_contact', header: 'sans_contact' },
  { key: 'part_sans_contact', header: 'part_sans_contact' },
]

const exportCities = async ({ item, month }: Extract<TExportRequest, { kind: 'month' }>): Promise<TExportResult> => {
  const cities = await getCityMetrics(month)
  const filename = `metriques-${item}-${month}.csv`
  if (item === 'tension-marche') {
    const rows = cities.map(
      (c): TTensionCsvRow => ({
        ville: c.cityName,
        disponibles: cell(c.disponibles),
        total_renseigne: cell(c.totalRenseigne),
        total_publie: cell(c.totalPublie),
        tension: percent(c.tension),
        couverture: percent(c.couverture),
      }),
    )
    return { filename, csv: toCsv(tensionColumns, rows) }
  }
  const rows = cities.map(
    (c): TZonesCsvRow => ({
      ville: c.cityName,
      recherches: c.recherches,
      residences_ouvertes: cell(c.residencesOuvertes),
      sans_contact: cell(c.residencesOuvertesSansContact),
      part_sans_contact: percent(c.partSansContact),
    }),
  )
  return { filename, csv: toCsv(zonesColumns, rows) }
}

type TTargetCsvRow = { gestionnaire: string; residences_avec_dispo: number; logements_disponibles: number }

const targetColumns: TCsvColumn<TTargetCsvRow>[] = [
  { key: 'gestionnaire', header: 'gestionnaire' },
  { key: 'residences_avec_dispo', header: 'residences_avec_dispo' },
  { key: 'logements_disponibles', header: 'logements_disponibles' },
]

const exportOwnersToTarget = async (): Promise<TExportResult> => {
  const owners = await getOwnersToTarget()
  const rows = owners.map(
    (o): TTargetCsvRow => ({
      gestionnaire: o.ownerName,
      residences_avec_dispo: o.residencesAvecDispo,
      logements_disponibles: o.logementsDisponibles,
    }),
  )
  return { filename: 'metriques-gestionnaires-a-cibler.csv', csv: toCsv(targetColumns, rows) }
}

export const buildExport = (request: TExportRequest): Promise<TExportResult> => {
  switch (request.kind) {
    case 'series':
      return exportSeries(request)
    case 'range':
      return exportContactPath(request)
    case 'static':
      return exportOwnersToTarget()
    case 'month':
      return request.item === 'moderation' ? exportModeration(request) : exportCities(request)
  }
}
