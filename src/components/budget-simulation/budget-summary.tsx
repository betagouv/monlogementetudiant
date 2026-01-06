'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { ExpensesPieChart } from '~/components/budget-simulation/expenses-pie-chart'
import { useBudgetSimulator } from './budget-simulator-context'
import styles from './budget-summary.module.css'

export function BudgetSummary() {
  const { state } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.summary')

  const totalIncomes = Object.values(state.monthlyIncomes).reduce((sum, amount) => sum + amount, 0)
  const totalExpenses = Object.values(state.monthlyExpenses).reduce((sum, amount) => sum + amount, 0)
  const remainingBalance = totalIncomes - totalExpenses

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount)
  }

  return (
    <div className="fr-flex fr-direction-column fr-pt-4w fr-pb-6w fr-px-5w">
      <span className="fr-text-inverted--grey fr-h3 fr-mb-0">{t('title')}</span>
      <span className={styles.summarySubtitle}>{t('subtitle')}</span>
      <div className={clsx(styles.border, 'fr-flex fr-direction-column fr-direction-md-row fr-mt-4w fr-mb-2w')}>
        <div className={clsx(styles.totalsContainer, 'fr-flex fr-direction-column fr-justify-content-center fr-py-2w fr-px-4w')}>
          <div className="fr-flex fr-direction-column fr-justify-content-space-between">
            <span className="fr-text--sm fr-text-inverted--grey fr-text--bold fr-mb-0">{t('totalIncome')}</span>
            <span className={clsx(styles.totalIncomes, 'fr-h3 fr-mb-0')}>{formatAmount(totalIncomes)}</span>
          </div>
          <hr className="fr-width-full fr-mb-0 fr-mt-2w" />
          <div className="fr-flex fr-direction-column fr-justify-content-space-between">
            <span className="fr-text--sm fr-text-inverted--grey fr-text--bold fr-mb-0">{t('totalExpenses')}</span>
            <span className={clsx(styles.totalExpenses, 'fr-h3 fr-mb-0')}>{formatAmount(totalExpenses)}</span>
          </div>
        </div>
        <div
          className={clsx(
            styles.totalsContainer,
            'fr-background-default--grey fr-py-2w fr-px-4w fr-flex fr-direction-column fr-align-items-center fr-justify-content-center',
          )}
        >
          <div className="fr-flex fr-direction-column fr-align-items-center">
            <span className="fr-mb-0">{t('remainingBalance')}</span>
            <span
              className={clsx(
                remainingBalance >= 0 ? styles.positiveRemainingBalance : styles.negativeRemainingBalance,
                'fr-h1 fr-text--bold fr-mb-0',
              )}
            >
              {remainingBalance >= 0 ? '+' : ''}
              {formatAmount(remainingBalance)}
            </span>
          </div>
        </div>
      </div>
      <ExpensesPieChart />
      <div className={clsx(styles.border, 'fr-flex fr-flex-gap-4v fr-direction-column fr-mt-4w fr-mb-2w fr-py-2w fr-px-4w')}>
        <span className="fr-text-inverted--grey fr-h4 fr-mb-0">{t('hintsTitle')}</span>
        <Button iconId="fr-icon-money-euro-circle-line" linkProps={{ href: '/preparer-mon-budget-etudiant', target: '_self' }}>
          {t('hintsCta')}
        </Button>
      </div>
    </div>
  )
}
