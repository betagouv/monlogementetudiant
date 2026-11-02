'use client'

import Button from '@codegouvfr/react-dsfr/Button'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { formatBudgetAmount, useBudgetSimulator, useBudgetTotals } from '~/components/budget-simulation/budget-simulator-context'
import summaryStyles from '~/components/budget-simulation/budget-summary.module.css'
import { ExpensesPieChart } from '~/components/budget-simulation/expenses-pie-chart'
import { createToast } from '~/components/ui/createToast'
import { LiveRegion } from '~/components/ui/live-region'
import { useSaveBudgetSimulation } from '~/hooks/use-budget-simulation'
import styles from './saved-budget.module.css'

const BUDGET_PDF_URL = '/api/student/budget-pdf'

async function downloadBudgetPdf() {
  const response = await fetch(BUDGET_PDF_URL)
  if (!response.ok) throw new Error(`Budget PDF failed: ${response.status}`)

  const fileName = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'mon-budget-etudiant.pdf'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function BudgetSummaryCard() {
  const t = useTranslations('budgetSimulator.summary')
  const tPdf = useTranslations('budgetSimulator.pdf')
  const { state } = useBudgetSimulator()
  const { totalIncomes, totalExpenses, remainingBalance } = useBudgetTotals()
  const { mutateAsync: saveSimulation } = useSaveBudgetSimulation({ silent: true })
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await saveSimulation(state)
      await downloadBudgetPdf()
    } catch {
      createToast({ priority: 'error', message: tPdf('error') })
    } finally {
      setIsDownloading(false)
    }
  }
  const savingsRate = totalIncomes > 0 && remainingBalance >= 0 ? (remainingBalance / totalIncomes) * 100 : null

  return (
    <div className={clsx(styles.summaryCard, 'fr-p-4w')}>
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
        <div>
          <Button
            priority="secondary"
            className="whiteButton"
            iconId="ri-download-2-line"
            iconPosition="left"
            onClick={handleDownload}
            disabled={isDownloading}
            nativeButtonProps={{ 'aria-busy': isDownloading }}
          >
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
