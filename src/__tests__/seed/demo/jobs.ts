/**
 * Données dérivées, produites par les vrais jobs de production plutôt que saisies à la main :
 * si le calcul ou la règle change, le seed suit sans modification.
 *
 * Ordre identique à la production : les métriques recopient les candidatures dans `application_fact`
 * (historique conservé), puis la purge RGPD anonymise les contacts de plus de 30 jours et supprime
 * les demandes non confirmées et les dossiers DossierFacile périmés.
 */
import { addMonths, format } from 'date-fns'
import { captureAvailabilitySnapshot } from '../../../server/admin/availability-follow-up'
import { captureMonth, syncApplicationFacts } from '../../../server/admin-metrics/capture'
import { purgeContactRequests } from '../../../server/contacts/purge'
import type { Clock } from '../random'

const METRIC_MONTHS = 6
const AVAILABILITY_SNAPSHOT_MONTHS = 6

export async function runProductionJobs(clock: Clock) {
  await syncApplicationFacts()

  // En production, chaque mois est relevé pendant le mois lui-même (cron quotidien). On rejoue ce
  // relevé mois par mois, du plus ancien au courant ; les compteurs d'état des mois passés reflètent
  // donc l'état actuel du référentiel, ce qui suffit pour une base de démonstration.
  for (let offset = METRIC_MONTHS; offset >= 0; offset--) {
    const monthDate = offset === 0 ? clock.now : addMonths(new Date(clock.now.getFullYear(), clock.now.getMonth(), 15, 12), -offset)
    await captureMonth(format(monthDate, 'yyyy-MM'), monthDate)
  }

  // Relevés du suivi des disponibilités, le 1er de chaque mois comme le cron. Calculés sur l'état actuel des
  // dispos : la fenêtre « à jour » glissant avec la date du relevé, la courbe varie d'un mois à l'autre.
  for (let offset = AVAILABILITY_SNAPSHOT_MONTHS - 1; offset >= 0; offset--) {
    await captureAvailabilitySnapshot(new Date(Date.UTC(clock.now.getFullYear(), clock.now.getMonth() - offset, 1, 1, 30)))
  }

  await purgeContactRequests()
}
