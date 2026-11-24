'use client'

import Breadcrumb from '@codegouvfr/react-dsfr/Breadcrumb'
import { Tabs } from '@codegouvfr/react-dsfr/Tabs'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useTRPC } from '~/server/trpc/client'
import { HousingAidCityDetail } from './housing-aid-city-detail'
import { HousingAidCityTable } from './housing-aid-city-table'
import { BudgetMetricCards, HousingAidMetricCards, HousingAidStatusTable, SIMULATIONS_HREF, SimulationSection } from './simulations-ui'

const TABS = ['aides', 'budget'] as const

export default function SimulationsPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.simulations.overview.queryOptions())
  const [tab, setTab] = useQueryState('onglet', parseAsStringLiteral(TABS).withDefault('aides'))
  // Ville sélectionnée dans l'URL : la vue détail se partage et le bouton « retour » du navigateur fonctionne.
  const cityKey = useSearchParams().get('ville')

  const housingAid = data?.housingAid

  if (cityKey) {
    const row = housingAid?.byCity.find((city) => city.key === cityKey)
    return (
      <>
        <Breadcrumb
          currentPageLabel={row?.city ?? (isLoading ? 'Chargement…' : 'Ville inconnue')}
          segments={[{ label: "Simulations d'aides au logement", linkProps: { href: SIMULATIONS_HREF } }]}
          classes={{ root: 'fr-mt-0 fr-mb-2w' }}
        />
        {isLoading ? (
          <p className="fr-text--sm">Chargement…</p>
        ) : (
          <HousingAidCityDetail row={row} totalSimulations={housingAid?.simulations ?? 0} />
        )}
      </>
    )
  }

  return (
    <>
      <div className="fr-mb-3w">
        <h1 className="fr-h3 fr-mb-0">Simulations des étudiants</h1>
        <p className="fr-text--sm fr-text-mention--grey fr-mt-1v fr-mb-0">
          Historique complet des versions de simulations sauvegardées par les étudiants connectés (les simulations anonymes du site public
          ne sont pas enregistrées).
        </p>
      </div>

      <Tabs
        selectedTabId={tab}
        onTabChange={(tabId) => setTab(tabId as (typeof TABS)[number])}
        tabs={[
          { tabId: 'aides', label: 'Aides au logement', iconId: 'fr-icon-home-4-line' },
          { tabId: 'budget', label: 'Budget', iconId: 'fr-icon-calculator-line' },
        ]}
      >
        {tab === 'aides' ? (
          <>
            <SimulationSection
              title="Vue d'ensemble"
              icon="fr-icon-bar-chart-box-line"
              description="Toutes les versions sont comptées : un étudiant qui modifie sa simulation compte plusieurs fois dans « Simulations », une seule fois dans « Étudiants »."
            >
              <HousingAidMetricCards metrics={housingAid} isLoading={isLoading} />
            </SimulationSection>

            <SimulationSection
              title="Par statut"
              icon="fr-icon-user-line"
              description="Le statut est multi-choix : une simulation compte dans chaque ligne qui la concerne, la somme des lignes peut dépasser le total."
            >
              {housingAid && housingAid.byStatus.length > 0 ? (
                <HousingAidStatusTable rows={housingAid.byStatus} caption="Simulations d'aides au logement par statut" />
              ) : (
                <p className="fr-text--sm fr-mb-0">{isLoading ? 'Chargement…' : 'Aucune simulation enregistrée pour le moment.'}</p>
              )}
            </SimulationSection>

            <SimulationSection
              title="Par ville visée"
              icon="fr-icon-map-pin-2-line"
              description="Cliquez sur une ville pour voir son détail par statut. La ville étant saisie librement, les variantes d'écriture sont regroupées ; la colonne « Étudiants » compte chaque étudiant une seule fois par ville."
            >
              {housingAid && housingAid.byCity.length > 0 ? (
                <HousingAidCityTable rows={housingAid.byCity} totalSimulations={housingAid.simulations} />
              ) : (
                <p className="fr-text--sm fr-mb-0">{isLoading ? 'Chargement…' : 'Aucune ville renseignée pour le moment.'}</p>
              )}
            </SimulationSection>
          </>
        ) : (
          <SimulationSection title="Vue d'ensemble" icon="fr-icon-bar-chart-box-line">
            <BudgetMetricCards budget={data?.budget} isLoading={isLoading} />
          </SimulationSection>
        )}
      </Tabs>
    </>
  )
}
