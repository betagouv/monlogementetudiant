import Table from '@codegouvfr/react-dsfr/Table'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { SimulationMetrics, SimulationStatusRow } from '~/server/admin/simulations-by-city'
import styles from '../administration.module.css'

export const SIMULATIONS_HREF = '/administration/simulations'

export const STATUS_LABELS: Record<string, string> = {
  student: 'Étudiant',
  apprentice: 'Apprenti',
  'employed-student': 'Étudiant salarié',
  lyceen: 'Lycéen',
  'boursier-crous': 'Boursier CROUS',
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const amount = (value: number | null) => (value === null ? '–' : euros.format(value))
export const rate = (value: number | null) => (value === null ? '–' : `${value} %`)
export const fmt = (value: number) => value.toLocaleString('fr-FR')

/** Bloc titré de la page simulations (carte admin avec en-tête). */
export function SimulationSection({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className={clsx(styles.card, 'fr-mb-3w')}>
      <div className={styles.cardHeader}>
        <h2 className={clsx(styles.cardTitle, 'fr-mb-0')}>
          <span className={clsx(icon, 'fr-icon--sm fr-mr-1w')} aria-hidden="true" />
          {title}
        </h2>
      </div>
      <div className="fr-p-3w">
        {description && <p className="fr-text--sm fr-text-mention--grey fr-mb-2w">{description}</p>}
        {children}
      </div>
    </section>
  )
}

type BudgetMetrics = { count: number; averageIncomes: number | null; averageExpenses: number | null; averageBalance: number | null }

/** Cartes d'indicateurs du simulateur de budget. */
export function BudgetMetricCards({ budget, isLoading }: { budget: BudgetMetrics | undefined; isLoading: boolean }) {
  return (
    <MetricCards
      isLoading={isLoading}
      cards={[
        { label: 'Simulations', value: budget ? fmt(budget.count) : '-', icon: 'fr-icon-calculator-line', color: styles.statCardBlue },
        {
          label: 'Revenus moyens / mois',
          value: amount(budget?.averageIncomes ?? null),
          icon: 'fr-icon-arrow-up-line',
          color: styles.statCardGreen,
        },
        {
          label: 'Dépenses moyennes / mois',
          value: amount(budget?.averageExpenses ?? null),
          icon: 'fr-icon-arrow-down-line',
          color: styles.statCardOrange,
        },
        {
          label: 'Solde moyen / mois',
          value: amount(budget?.averageBalance ?? null),
          icon: 'fr-icon-money-euro-circle-line',
          color: styles.statCardPurple,
        },
      ]}
    />
  )
}

type MetricCard = { label: string; value: string; icon: string; color: string }

function MetricCards({ cards, isLoading }: { cards: MetricCard[]; isLoading: boolean }) {
  return (
    <div className={clsx(styles.statsGrid, cards.length === 5 && styles.statsGrid5)}>
      {cards.map((card) => (
        <div key={card.label} className={clsx(styles.statCard, card.color)}>
          <div className={styles.statLabel}>{card.label}</div>
          <div className={clsx(styles.statValue, 'fr-mt-1v')}>{isLoading ? '-' : card.value}</div>
          <span className={clsx(card.icon, styles.statIcon)} aria-hidden="true" />
        </div>
      ))}
    </div>
  )
}

/** Cartes d'indicateurs du simulateur d'aides (global ou pour une ville). */
export function HousingAidMetricCards({ metrics, isLoading = false }: { metrics: SimulationMetrics | undefined; isLoading?: boolean }) {
  const cards: MetricCard[] = [
    { label: 'Simulations', value: metrics ? fmt(metrics.simulations) : '-', icon: 'fr-icon-calculator-line', color: styles.statCardBlue },
    { label: 'Étudiants', value: metrics ? fmt(metrics.students) : '-', icon: 'fr-icon-user-line', color: styles.statCardPurple },
    {
      label: 'Revenus moyens / mois',
      value: amount(metrics?.averageIncome ?? null),
      icon: 'fr-icon-arrow-up-line',
      color: styles.statCardGreen,
    },
    {
      label: 'Loyer moyen envisagé',
      value: amount(metrics?.averageRent ?? null),
      icon: 'fr-icon-home-4-line',
      color: styles.statCardOrange,
    },
    { label: 'Avec garant', value: rate(metrics?.guarantorRate ?? null), icon: 'fr-icon-shield-line', color: styles.statCardRed },
  ]

  return <MetricCards cards={cards} isLoading={isLoading} />
}

export function HousingAidStatusTable({ rows, caption }: { rows: SimulationStatusRow[]; caption: string }) {
  return (
    <Table
      noCaption
      caption={caption}
      headers={['Statut', 'Simulations', 'Étudiants', 'Revenus moyens', 'Loyer moyen envisagé', 'Avec garant']}
      data={rows.map((row) => [
        STATUS_LABELS[row.status] ?? row.status,
        fmt(row.simulations),
        fmt(row.students),
        amount(row.averageIncome),
        amount(row.averageRent),
        rate(row.guarantorRate),
      ])}
    />
  )
}
