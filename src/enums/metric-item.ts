export enum EMetricItem {
  CONTACTS_TRANSMIS = 'contacts_transmis',
  ETUDIANTS_CONTACTES = 'etudiants_contactes',
  LOGEMENTS_ATTRIBUES = 'logements_attribues',
  CONSULT_OFFER_BASE = 'consult_offer_base',
  CONSULT_OFFER_MATOMO = 'consult_offer_matomo',
  OWNER_LANDING_CLICK = 'owner_landing_click',
  COMPTES_CREES = 'comptes_crees',
  ALERTES_BASE = 'alertes_base',
  ALERTES_MATOMO = 'alertes_matomo',
  FAVORIS_BASE = 'favoris_base',
  FAVORIS_MATOMO = 'favoris_matomo',
  SIMULATIONS_AIDES_BASE = 'simulations_aides_base',
  SIMULATIONS_AIDES_MATOMO = 'simulations_aides_matomo',
  SIMULATIONS_BUDGET_BASE = 'simulations_budget_base',
  SIMULATIONS_BUDGET_MATOMO = 'simulations_budget_matomo',
  ETUDIANTS_BOURSIERS = 'etudiants_boursiers',
}

export type TMetricSource = 'Base — étudiants connectés' | 'Matomo — toutes visites' | 'Relevé mensuel'

const BASE: TMetricSource = 'Base — étudiants connectés'
const MATOMO: TMetricSource = 'Matomo — toutes visites'
const RELEVE: TMetricSource = 'Relevé mensuel'

const SIMULATION_BASE_HELP =
  'Étudiants connectés ayant fait leur première simulation dans le mois ; Matomo compte toutes les simulations, y compris des visiteurs non connectés'
const TRACKED_HELP =
  'Le nombre couvre toutes les visites suivies par la plateforme ; la part de boursiers ne concerne que les étudiants connectés'

export const METRIC_ITEM_META: Record<EMetricItem, { label: string; source: TMetricSource; help?: string }> = {
  [EMetricItem.CONTACTS_TRANSMIS]: { label: 'Contacts étudiants transmis', source: BASE },
  [EMetricItem.ETUDIANTS_CONTACTES]: { label: 'Étudiants contactés par les gestionnaires', source: BASE },
  [EMetricItem.LOGEMENTS_ATTRIBUES]: { label: 'Logements attribués déclarés par les gestionnaires', source: BASE },
  [EMetricItem.CONSULT_OFFER_BASE]: { label: "Clics « Consulter l'offre »", source: RELEVE, help: TRACKED_HELP },
  [EMetricItem.CONSULT_OFFER_MATOMO]: { label: "Clics « Consulter l'offre »", source: MATOMO },
  [EMetricItem.OWNER_LANDING_CLICK]: { label: 'Clics sur le lien du gestionnaire', source: RELEVE, help: TRACKED_HELP },
  [EMetricItem.COMPTES_CREES]: { label: 'Comptes étudiants créés', source: BASE },
  [EMetricItem.ALERTES_BASE]: { label: 'Alertes créées', source: BASE, help: 'Les alertes supprimées depuis ne sont plus comptées' },
  [EMetricItem.ALERTES_MATOMO]: { label: 'Alertes créées', source: MATOMO },
  [EMetricItem.FAVORIS_BASE]: { label: 'Favoris ajoutés', source: BASE, help: 'Les favoris supprimés depuis ne sont plus comptés' },
  [EMetricItem.FAVORIS_MATOMO]: { label: 'Favoris ajoutés', source: MATOMO },
  [EMetricItem.SIMULATIONS_AIDES_BASE]: { label: "Simulations d'aides", source: BASE, help: SIMULATION_BASE_HELP },
  [EMetricItem.SIMULATIONS_AIDES_MATOMO]: { label: "Simulations d'aides", source: MATOMO },
  [EMetricItem.SIMULATIONS_BUDGET_BASE]: { label: 'Simulations de budget', source: BASE, help: SIMULATION_BASE_HELP },
  [EMetricItem.SIMULATIONS_BUDGET_MATOMO]: { label: 'Simulations de budget', source: MATOMO },
  [EMetricItem.ETUDIANTS_BOURSIERS]: {
    label: 'Étudiants boursiers',
    source: RELEVE,
    help: "Nombre d'étudiants inscrits selon leur statut boursier actuel, relevé chaque nuit",
  },
}
