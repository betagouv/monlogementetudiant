'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { formatBudgetAmount, useBudgetTotals } from '~/components/budget-simulation/budget-simulator-context'
import summaryStyles from '~/components/budget-simulation/budget-summary.module.css'
import { ExpensesPieChart } from '~/components/budget-simulation/expenses-pie-chart'
import { LiveRegion } from '~/components/ui/live-region'
import styles from './saved-budget.module.css'

function printBudgetSummary() {
  document.body.classList.add('budgetPrintMode')
  try {
    window.print()
  } finally {
    document.body.classList.remove('budgetPrintMode')
  }
}

export function BudgetSummaryCard() {
  const t = useTranslations('budgetSimulator.summary')
  const { totalIncomes, totalExpenses, remainingBalance } = useBudgetTotals()
  const savingsRate = totalIncomes > 0 && remainingBalance >= 0 ? (remainingBalance / totalIncomes) * 100 : null

  return (
    <div className={clsx(styles.summaryCard, 'budgetPrintArea fr-p-4w')}>
      <LiveRegion
        debounceMs={1200}
        message={t('announcement', {
          incomes: formatBudgetAmount(totalIncomes),
          expenses: formatBudgetAmount(totalExpenses),
          balance: formatBudgetAmount(remainingBalance),
        })}
      />
      <div className="fr-flex fr-direction-column fr-direction-md-row fr-justify-content-space-between fr-flex-gap-4v">
        <div className="fr-flex fr-direction-column">
          <h2 className="fr-text-inverted--grey fr-h3 fr-mb-0">{t('title')}</h2>
          <span className={summaryStyles.summarySubtitle}>{t('subtitle')}</span>
        </div>
        <div className="budgetPrintHidden">
          <Button priority="secondary" className="whiteButton" iconId="ri-download-2-line" iconPosition="left" onClick={printBudgetSummary}>
            {t('downloadPdfCta')}
          </Button>
        </div>
      </div>
      <div className="fr-grid-row fr-grid-row--gutters fr-mt-2w">
        <div className="fr-col-12 fr-col-md-6">
          <div className={clsx(summaryStyles.border, 'fr-flex fr-direction-column fr-height-full')}>
            <div className="fr-flex fr-direction-column fr-align-items-center fr-text--center fr-py-2w fr-px-4w">
              <span className="fr-text--sm fr-text-inverted--grey fr-text--bold fr-mb-0">{t('totalIncome')}</span>
              <span className={clsx(summaryStyles.totalIncomes, 'fr-h3 fr-mb-0')}>{formatBudgetAmount(totalIncomes)}</span>
            </div>
            <hr className="fr-width-full fr-my-0" />
            <div className="fr-flex fr-direction-column fr-align-items-center fr-text--center fr-py-2w fr-px-4w">
              <span className="fr-text--sm fr-text-inverted--grey fr-text--bold fr-mb-0">{t('totalExpenses')}</span>
              <span className={clsx(summaryStyles.totalExpenses, 'fr-h3 fr-mb-0')}>{formatBudgetAmount(totalExpenses)}</span>
              <span className={clsx(summaryStyles.annualTotal, 'fr-text--xs fr-mb-0')}>
                {t('annualTotal', { amount: formatBudgetAmount(totalExpenses * 12) })}
              </span>
            </div>
            <div className="fr-background-default--grey fr-flex fr-flex-grow-1 fr-direction-column fr-align-items-center fr-justify-content-center fr-py-3w fr-px-4w">
              <span className="fr-mb-0">{t('remainingBalance')}</span>
              <span
                className={clsx(
                  remainingBalance >= 0 ? summaryStyles.positiveRemainingBalance : summaryStyles.negativeRemainingBalance,
                  'fr-h1 fr-text--bold fr-mb-0',
                )}
              >
                {remainingBalance >= 0 ? '+' : ''}
                {formatBudgetAmount(remainingBalance)}
              </span>
              {savingsRate !== null && (
                <span className="fr-text--xs fr-text-mention--grey fr-mb-0">
                  {t('savingsRate', { rate: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(savingsRate) })}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="fr-col-12 fr-col-md-6">
          <ExpensesPieChart className="fr-height-full" />
        </div>
      </div>
    </div>
  )
}
