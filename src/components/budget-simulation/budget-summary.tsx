'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { ExpensesPieChart } from '~/components/budget-simulation/expenses-pie-chart'
import { LiveRegion } from '~/components/ui/live-region'
import { useWidgetCampaign } from '~/components/widget/widget-campaign-context'
import { trackEvent } from '~/lib/tracking'
import { appendWidgetCampaign, type TOutboundLinkTarget } from '~/utils/widget-campaign'
import { formatBudgetAmount, useBudgetSimulator, useBudgetTotals } from './budget-simulator-context'
import styles from './budget-summary.module.css'
import { BudgetSummaryActions } from './budget-summary-actions'

/** `ctaTarget` : cible du bouton de fin de parcours. `_top` pour une intégration en iframe (widget). */
export function BudgetSummary({ ctaTarget = '_self' }: { ctaTarget?: TOutboundLinkTarget } = {}) {
  const { state } = useBudgetSimulator()
  const t = useTranslations('budgetSimulator.summary')
  const widgetCampaign = useWidgetCampaign()

  const { totalIncomes, totalExpenses, remainingBalance } = useBudgetTotals()

  const yearlyExpensesTotal = state.activeExpenseTypes
    .filter((type) => state.expenseFrequencies[type] === 'yearly')
    .reduce((sum, type) => sum + state.monthlyExpenses[type], 0)
  const monthlyExpensesTotal = state.activeExpenseTypes
    .filter((type) => state.expenseFrequencies[type] === 'monthly')
    .reduce((sum, type) => sum + state.monthlyExpenses[type], 0)
  const firstMonthTotal = monthlyExpensesTotal + yearlyExpensesTotal
  const hasTrackedCompletion = useRef(false)

  useEffect(() => {
    if (totalIncomes > 0 && totalExpenses > 0 && !hasTrackedCompletion.current) {
      hasTrackedCompletion.current = true
      trackEvent({
        category: 'Simulateur',
        action: 'completion simulateur budget',
        name: remainingBalance >= 0 ? 'excedent' : 'deficit',
      })
    }
  }, [totalIncomes, totalExpenses, remainingBalance])

  const formatAmount = formatBudgetAmount

  const savingsRate = totalIncomes > 0 && remainingBalance >= 0 ? (remainingBalance / totalIncomes) * 100 : null

  return (
    <div className="fr-flex fr-direction-column fr-pt-4w fr-pb-6w fr-px-5w">
      <LiveRegion
        debounceMs={1200}
        message={t('announcement', {
          incomes: formatAmount(totalIncomes),
          expenses: formatAmount(totalExpenses),
          balance: formatAmount(remainingBalance),
        })}
      />
      <h2 className="fr-text-inverted--grey fr-h3 fr-mb-0">{t('title')}</h2>
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
            <span className={clsx(styles.annualTotal, 'fr-text--xs fr-mb-0')}>
              {t('annualTotal', { amount: formatAmount(totalExpenses * 12) })}
            </span>
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
            {savingsRate !== null && (
              <span className="fr-text--xs fr-text-mention--grey fr-mb-0">
                {t('savingsRate', { rate: new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(savingsRate) })}
              </span>
            )}
          </div>
        </div>
      </div>
      <BudgetSummaryActions ctaTarget={ctaTarget} />
      <ExpensesPieChart horizontal />
      {yearlyExpensesTotal > 0 && (
        <div className={clsx(styles.border, 'fr-flex fr-direction-column fr-mt-4w fr-mb-2w fr-py-2w fr-px-4w')}>
          <h3 className="fr-text-inverted--grey fr-h6 fr-mb-2w">{t('schoolYearBudgetTitle')}</h3>
          <p className="fr-text--sm fr-text-inverted--grey fr-mb-0">
            {t('schoolYearBudgetDescription', {
              firstMonth: formatAmount(firstMonthTotal),
              followingMonths: formatAmount(monthlyExpensesTotal),
            })}
          </p>
        </div>
      )}
      <div className={clsx(styles.border, 'fr-flex fr-flex-gap-4v fr-direction-column fr-mt-4w fr-mb-2w fr-py-2w fr-px-4w')}>
        <h3 className="fr-text-inverted--grey fr-h4 fr-mb-0">{t('hintsTitle')}</h3>
        <Button
          priority="secondary"
          className="whiteButton"
          iconId="fr-icon-money-euro-circle-line"
          linkProps={{ href: appendWidgetCampaign('/preparer-mon-budget-etudiant', widgetCampaign), target: ctaTarget }}
        >
          {t('hintsCta')}
        </Button>
      </div>
    </div>
  )
}
