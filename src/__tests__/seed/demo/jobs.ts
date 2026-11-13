/**
 * Données dérivées, produites par les vrais jobs de production plutôt que saisies à la main :
 * si le calcul ou la règle change, le seed suit sans modification.
 *
 * Ordre identique à la production : les métriques recopient les candidatures dans `application_fact`
 * (historique conservé), puis la purge RGPD anonymise les contacts de plus de 30 jours et supprime
 * les demandes non confirmées et les dossiers DossierFacile périmés.
 */
import { addMonths, format } from 'date-fns'
import { captureMonth, syncApplicationFacts } from '../../../server/admin-metrics/capture'
import { purgeContactRequests } from '../../../server/contacts/purge'
import type { Clock } from '../random'

const METRIC_MONTHS = 6

export async function runProductionJobs(clock: Clock) {
  await syncApplicationFacts()

  // En production, chaque mois est relevé pendant le mois lui-même (cron quotidien). On rejoue ce
  // relevé mois par mois, du plus ancien au courant ; les compteurs d'état des mois passés reflètent
  // donc l'état actuel du référentiel, ce qui suffit pour une base de démonstration.
  for (let offset = METRIC_MONTHS; offset >= 0; offset--) {
    const monthDate = offset === 0 ? clock.now : addMonths(new Date(clock.now.getFullYear(), clock.now.getMonth(), 15, 12), -offset)
    await captureMonth(format(monthDate, 'yyyy-MM'), monthDate)
  }

  await purgeContactRequests()
}
