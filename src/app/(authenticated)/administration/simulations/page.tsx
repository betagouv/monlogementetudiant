'use client'

import Table from '@codegouvfr/react-dsfr/Table'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { useTRPC } from '~/server/trpc/client'
import { sPluriel } from '~/utils/sPluriel'
import styles from '../administration.module.css'

const STATUS_LABELS: Record<string, string> = {
  student: 'Étudiant',
  apprentice: 'Apprenti',
  'employed-student': 'Étudiant salarié',
  lyceen: 'Lycéen',
  'boursier-crous': 'Boursier CROUS',
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const amount = (value: number | null) => (value === null ? '–' : euros.format(value))

export default function SimulationsPage() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.admin.simulations.overview.queryOptions())

  const budget = data?.budget
  const housingAid = data?.housingAid

  const budgetCards = [
    {
      label: `Simulation${sPluriel(budget?.count ?? 0)} de budget`,
      value: budget?.count ?? '-',
      icon: 'fr-icon-calculator-line',
      colorClass: styles.statCardBlue,
    },
    {
      label: 'Revenus moyens / mois',
      value: amount(budget?.averageIncomes ?? null),
      icon: 'fr-icon-arrow-up-line',
      colorClass: styles.statCardGreen,
    },
    {
      label: 'Dépenses moyennes / mois',
      value: amount(budget?.averageExpenses ?? null),
      icon: 'fr-icon-arrow-down-line',
      colorClass: styles.statCardOrange,
    },
    {
      label: 'Solde moyen / mois',
      value: amount(budget?.averageBalance ?? null),
      icon: 'fr-icon-money-euro-circle-line',
      colorClass: styles.statCardPurple,
    },
  ]

  return (
    <div>
      <div className="fr-mb-3w">
        <h1 className="fr-h3 fr-mb-0">Simulations des étudiants</h1>
        <p className="fr-text--sm fr-text-mention--grey fr-mb-0">
          Historique complet des versions de simulations sauvegardées par les étudiants connectés (les simulations anonymes du site public
          ne sont pas enregistrées).
        </p>
      </div>

      <h2 className="fr-h5">Simulateur de budget</h2>
      <div className={clsx(styles.statsGrid, 'fr-mb-3w')}>
        {budgetCards.map((card) => (
          <div key={card.label} className={clsx(styles.statCard, card.colorClass)}>
            <div className={styles.statLabel}>{card.label}</div>
            <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : card.value}</div>
            <span className={clsx(card.icon, styles.statIcon)} aria-hidden="true" />
          </div>
        ))}
      </div>

      <h2 className="fr-h5">
        Simulateur d'aides au logement
        {housingAid ? ` — ${housingAid.count} simulation${sPluriel(housingAid.count)}` : ''}
      </h2>
      <p className="fr-text--sm fr-text-mention--grey">
        Le statut est multi-choix : une simulation compte dans chaque ligne qui la concerne, la somme des lignes peut dépasser le total.
      </p>
      {housingAid && housingAid.byStatus.length > 0 ? (
        <Table
          headers={['Statut', 'Simulations', 'Revenus moyens', 'Loyer moyen envisagé', 'Avec garant']}
          data={housingAid.byStatus.map((row) => [
            STATUS_LABELS[row.status] ?? row.status,
            row.count,
            amount(row.averageIncome),
            amount(row.averageRent),
            row.guarantorRate === null ? '–' : `${row.guarantorRate} %`,
          ])}
        />
      ) : (
        <p className="fr-text--sm">{isLoading ? 'Chargement…' : 'Aucune simulation enregistrée pour le moment.'}</p>
      )}
    </div>
  )
}
