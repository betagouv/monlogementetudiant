import Alert from '@codegouvfr/react-dsfr/Alert'
import Badge from '@codegouvfr/react-dsfr/Badge'
import type { SimulationCityRow } from '~/server/admin/simulations-by-city'
import { HousingAidMetricCards, HousingAidStatusTable, SimulationSection } from './simulations-ui'

/** Détail d'une ville visée : mêmes indicateurs que la vue globale, restreints aux simulations de la ville. */
export function HousingAidCityDetail({ row, totalSimulations }: { row: SimulationCityRow | undefined; totalSimulations: number }) {
  if (!row) {
    return (
      <>
        <h1 className="fr-h3">Ville introuvable</h1>
        <Alert severity="info" small description="Aucune simulation d'aides au logement enregistrée pour cette ville." />
      </>
    )
  }

  const share = totalSimulations ? Math.round((row.simulations / totalSimulations) * 100) : 0

  return (
    <>
      <div className="fr-mb-3w">
        <div className="fr-flex fr-flex-wrap fr-align-items-center fr-flex-gap-2v">
          <h1 className="fr-h3 fr-mb-0">{row.city}</h1>
          {row.isUniversityCity && (
            <Badge small severity="info" noIcon>
              Ville universitaire
            </Badge>
          )}
        </div>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v fr-mb-0">
          Simulations d'aides au logement visant cette ville : {share} % de l'ensemble des simulations.
        </p>
      </div>

      <SimulationSection
        title="Vue d'ensemble"
        icon="fr-icon-bar-chart-box-line"
        description="Toutes les versions sont comptées : un étudiant qui modifie sa simulation compte plusieurs fois dans « Simulations », une seule fois dans « Étudiants »."
      >
        <HousingAidMetricCards metrics={row} />
      </SimulationSection>

      <SimulationSection
        title="Par statut"
        icon="fr-icon-user-line"
        description="Le statut est multi-choix : une simulation compte dans chaque ligne qui la concerne."
      >
        <HousingAidStatusTable rows={row.byStatus} caption={`Simulations d'aides au logement à ${row.city} par statut`} />
      </SimulationSection>
    </>
  )
}
